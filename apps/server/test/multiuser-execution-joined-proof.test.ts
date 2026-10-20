import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {buildApp} from '../src/app.js';
import {ExecutionFailure,type ExecutionStep} from '../src/execution-engine.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {TaskAuthorization} from '../src/scope/task-authorization.js';
import {Accounts} from '../src/scope/accounts.js';
import type {TaskExecution,TaskRun} from '../src/scope/task-execution.js';
import type {PrivateData} from '../src/scope/private-data.js';
import {PrivateSql} from '../src/scope/private-data-sql.js';

const password='Generated-joined-proof-password-01';
const headers={'x-mote-protocol-version':'2'};
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};};
type NodeHost=Awaited<ReturnType<typeof buildApp>>&{execution:TaskExecution};
const role=(sql:string)=>sql.includes('validation_task_user_id')?'joined':sql==='SELECT user_id,grant_id FROM user_tasks WHERE task_id=?'?'task':sql==='SELECT 1 FROM task_lifecycle_state WHERE user_id=? AND deleted=1'?'lifecycle':sql==='SELECT * FROM task_authorizations WHERE grant_id=? AND revoked=0'?'grant':sql==='SELECT disabled,authorization_epoch FROM auth_accounts WHERE user_id=?'?'account':sql==='SELECT model_receipt FROM user_tasks WHERE task_id=?'?'model':'other';
function observe(db:DatabaseSync){
 const counts={get:{} as Record<string,number>,prepare:{} as Record<string,number>,run:0,all:0,iterate:0,errors:0,overflow:0};let enabled=false;
 const prepare=db.prepare;
 db.prepare=function(sql:string){const name=role(sql);if(enabled)counts.prepare[name]=(counts.prepare[name]??0)+1;const statement=Reflect.apply(prepare,this,[sql]);
  for(const method of ['get','run','all','iterate'] as const){const original=statement[method];(statement as any)[method]=function(...args:unknown[]){if(enabled){if(method==='get')counts.get[name]=(counts.get[name]??0)+1;else counts[method]++;if(Object.values(counts.get).reduce((a,b)=>a+b,0)>100000){counts.overflow++;throw Error('Generated observer hard cap');}}try{return Reflect.apply(original,this,args);}catch(error){if(enabled)counts.errors++;throw error;}};}
  return statement;
 };
 return {counts,start:()=>{counts.get={};counts.prepare={};counts.run=counts.all=counts.iterate=counts.errors=counts.overflow=0;enabled=true;},stop:()=>{enabled=false;return structuredClone(counts);}};
}
async function fixture(t:TestContext,options:{count?:boolean;large?:boolean}={}){
 const directory=mkdtempSync(join(tmpdir(),'mote-joined-proof-')),node=await buildApp({dataDir:directory}) as NodeHost;
 assert.ok(node.execution);const db=node.execution.engine.store.db,observer=options.count?observe(db):undefined;
 const releases:(()=>void)[]=[],state={permit:false,validateCalls:0,validateHook:undefined as undefined|((step:ExecutionStep)=>void),executeHook:undefined as undefined|((run:TaskRun)=>Promise<void>),commitHook:undefined as undefined|((run:TaskRun)=>void)},executed:string[]=[],committed:string[]=[];
 let closed=false;
 t.after(async()=>{for(const release of releases)release();if(!db.isOpen)db.open();if(!closed){closed=true;await node.app.close();}rmSync(directory,{recursive:true,force:true});});
 node.execution.register({kind:'generated.joined-proof',pool:'generated-joined-proof',concurrency:()=>2,policy:EXECUTION_POLICIES.deterministic,
  parseInput:value=>value as Record<string,unknown>,portableInput:value=>value,
  validate:step=>{state.validateCalls++;state.validateHook?.(step);return true;},
  admit:()=>state.permit?undefined:new ExecutionFailure('waiting','generated_hold_admission',60000),
  execute:async run=>{executed.push(run.task.id);await state.executeHook?.(run);return {label:run.task.input.label};},
  commit:run=>{state.commitHook?.(run);committed.push(run.task.id);},
 });
 await node.accounts!.initialize('generated-proof-admin',password);
 const request=(token:string|undefined,url:string,method:'GET'|'POST'='GET',payload?:unknown)=>node.app.inject({method,url,headers:{...headers,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const response=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'});assert.equal(response.statusCode,200,response.body);return response.json().token as string;};
 const admin=await login('generated-proof-admin');
 const create=async(username:string)=>{const response=await request(admin,'/api/admin/accounts','POST',{username,password,administrator:false});assert.equal(response.statusCode,200,response.body);const account=response.json();return {...account,token:await login(username)};};
 const a=await create('generated-proof-a'),b=await create('generated-proof-b');
 const submit=async(token:string,operationId:string,payload='generated')=>{const response=await request(token,'/api/tasks','POST',{kind:'generated.joined-proof',operationId,input:{label:operationId,payload}});assert.equal(response.statusCode,200,response.body);return response.json().id as string;};
 const ids={a:await submit(a.token,'same-business',options.large?'a'.repeat(256*1024):'generated-a'),b:await submit(b.token,'same-business','b'.repeat(1024))};
 assert.notEqual(ids.a,ids.b);assert.equal(node.execution.engine.get(ids.a)?.state,'waiting');assert.equal(node.execution.engine.get(ids.b)?.state,'waiting');
 const grants=new TaskAuthorization(db,node.accounts!,node.deploymentId),ownerA=node.execution.engine.get(ids.a)!.ownership!,ownerB=node.execution.engine.get(ids.b)!.ownership!;
 const current=(id=ids.a)=>node.execution.engine.isCurrentInputAuthority(id);
 const other=()=>new DatabaseSync(join(directory,'mote.sqlite'));
 const finish=async()=>{state.permit=true;for(const [id,token] of [[ids.a,a.token],[ids.b,b.token]]){const response=await request(token,'/api/tasks/'+id+'/retry','POST',{});assert.equal(response.statusCode,200,response.body);}await node.execution.engine.drain([ids.a,ids.b]);for(const id of [ids.a,ids.b]){assert.equal(node.execution.engine.get(id)?.state,'succeeded');assert.equal(executed.filter(x=>x===id).length,1);assert.equal(committed.filter(x=>x===id).length,1);}};
 return {node,db,directory,observer,state,executed,committed,request,submit,a,b,ids,ownerA,ownerB,grants,current,other,finish,releases,close:async()=>{if(!closed){closed=true;await node.app.close();}}};
}
function changed(db:DatabaseSync,change:()=>void,check:()=>void){db.exec('SAVEPOINT generated_joined_check');try{change();check();}finally{db.exec('ROLLBACK TO generated_joined_check; RELEASE generated_joined_check');}}

test('real admitted tasks preserve fresh fact rejection, complete grant shape and native failure recovery',async t=>{
 const f=await fixture(t),{db,ids,ownerA,ownerB}=f;assert.equal(f.current(),true);assert.equal(f.current(ids.b),true);
 const original=f.grants.assert(ownerA.grantId!,ownerA.userId,ownerA.authorizationEpoch);
 assert.deepEqual(Object.keys(original),['grant_id','task_id','user_id','authorization_epoch','revoked']);assert.equal(Object.getPrototypeOf(original),null);
 assert.equal(original.task_id,ids.a);assert.equal(original.revoked,0);
 const reject=(name:string,sql:string,...args:SQLInputValue[])=>t.test(name,()=>changed(db,()=>{db.prepare(sql).run(...args);},()=>{assert.equal(f.current(),false,name);assert.equal(f.current(ids.b),true,'other owner remains current');}));
 await reject('missing task','DELETE FROM user_tasks WHERE task_id=?',ids.a);
 await reject('foreign task owner','UPDATE user_tasks SET user_id=?,user_position=user_position+1000 WHERE task_id=?',ownerB.userId,ids.a);
 await reject('different task grant','UPDATE user_tasks SET grant_id=? WHERE task_id=?','generated-missing-grant',ids.a);
 await reject('account lifecycle deletion','INSERT INTO task_lifecycle_state(user_id,deleted) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET deleted=1',ownerA.userId);
 await t.test('absent and non-deleted lifecycle remain admitted',()=>{for(const deleted of [0,2])changed(db,()=>{db.prepare('INSERT INTO task_lifecycle_state(user_id,deleted) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET deleted=excluded.deleted').run(ownerA.userId,deleted);},()=>assert.equal(f.current(),true));});
 await reject('missing durable grant','DELETE FROM task_authorizations WHERE grant_id=?',ownerA.grantId!);
 await reject('revoked durable grant','UPDATE task_authorizations SET revoked=1 WHERE grant_id=?',ownerA.grantId!);
 await reject('foreign grant owner','UPDATE task_authorizations SET user_id=? WHERE grant_id=?',ownerB.userId,ownerA.grantId!);
 await reject('different grant task','UPDATE task_authorizations SET task_id=? WHERE grant_id=?','generated-other-task',ownerA.grantId!);
 await reject('wrong grant epoch','UPDATE task_authorizations SET authorization_epoch=authorization_epoch+1 WHERE grant_id=?',ownerA.grantId!);
 for(const [label,value] of [['text','generated-invalid'],['blob',Buffer.from([1,2])],['real',0.25],['unsafe-integer',9007199254740993n]] as const)await reject('native grant epoch '+label,'UPDATE task_authorizations SET authorization_epoch=? WHERE grant_id=?',value,ownerA.grantId!);
 await reject('disabled account','UPDATE auth_accounts SET disabled=1 WHERE user_id=?',ownerA.userId);
 await reject('changed account epoch','UPDATE auth_accounts SET authorization_epoch=authorization_epoch+1 WHERE user_id=?',ownerA.userId);
 await t.test('missing account is not authority',()=>{db.exec('PRAGMA foreign_keys=OFF');try{changed(db,()=>{db.prepare('DELETE FROM auth_accounts WHERE user_id=?').run(ownerA.userId);},()=>assert.equal(f.current(),false));}finally{db.exec('PRAGMA foreign_keys=ON');}});
 await t.test('independent committed grant change is seen on the next call',()=>{const other=f.other();try{other.prepare('UPDATE task_authorizations SET revoked=1 WHERE grant_id=?').run(ownerA.grantId!);assert.equal(f.current(),false);other.prepare('UPDATE task_authorizations SET revoked=0 WHERE grant_id=?').run(ownerA.grantId!);assert.equal(f.current(),true);}finally{other.close();}});
 await t.test('schema failure remains false and repaired warm statement is fresh',()=>{changed(db,()=>db.exec('ALTER TABLE task_lifecycle_state RENAME TO generated_saved_lifecycle'),()=>assert.equal(f.current(),false));assert.equal(f.current(),true);});
 await t.test('native full grant decode failure cannot be hidden by unused projections',()=>{changed(db,()=>{db.prepare('UPDATE task_authorizations SET authorization_epoch=? WHERE grant_id=?').run(9007199254740993n,ownerA.grantId!);},()=>{assert.throws(()=>f.grants.assert(ownerA.grantId!));assert.equal(f.current(),false);});assert.equal(f.current(),true);});
 await t.test('same DatabaseSync reopen discards finalized statements without reviving a retired host',()=>{db.close();assert.throws(()=>f.current(),{code:'ERR_INVALID_STATE'});db.open();db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');assert.equal(f.current(),true);assert.deepEqual(f.grants.assert(ownerA.grantId!),original);});
 await f.finish();await f.close();
 const restarted=await buildApp({dataDir:f.directory});try{assert.ok(restarted.execution);assert.deepEqual(restarted.execution.engine.get(ids.a)!.ownership,ownerA);const response=await restarted.app.inject({url:'/api/tasks/'+ids.a,headers:{...headers,authorization:'Bearer '+f.a.token}});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().state,'succeeded');}finally{await restarted.app.close();}
});

test('domain callbacks, held work and private publication retain independent authority checkpoints',async t=>{
 const f=await fixture(t),other=f.other();t.after(()=>other.close());
 let triggered=false;f.state.validateHook=step=>{if(step.id===f.ids.a&&!triggered){triggered=true;other.prepare('UPDATE task_authorizations SET revoked=1 WHERE grant_id=?').run(f.ownerA.grantId!);}};
 assert.equal(f.current(),false,'second valid must observe callback revocation');assert.equal(triggered,true);f.state.validateHook=undefined;other.prepare('UPDATE task_authorizations SET revoked=0 WHERE grant_id=?').run(f.ownerA.grantId!);assert.equal(f.current(),true);
 const entered=deferred(),release=deferred();f.releases.push(release.resolve);let retained:TaskRun|undefined,privateData:PrivateData|undefined;
 f.state.executeHook=async run=>{if(run.task.id===f.ids.a){retained=run;privateData=run.services.get<PrivateData>('private-data');entered.resolve();await release.promise;}};
 f.state.permit=true;f.node.execution.engine.retry(f.ids.a);f.node.execution.engine.retry(f.ids.b);const running=f.node.execution.engine.tick();await entered.promise;
 assert.ok(retained);assert.deepEqual(privateData!.sources(),[]);
 const cancelled=await f.request(f.a.token,'/api/tasks/'+f.ids.a+'/cancel','POST',{});assert.equal(cancelled.statusCode,200,cancelled.body);
 assert.throws(()=>privateData!.sources(),{code:'invalid_identity'});assert.throws(()=>retained!.services.get('private-data'),{code:'invalid_identity'});assert.throws(()=>retained!.checkpoint.write('late',{generated:true}));assert.throws(()=>retained!.grant.commit(()=>assert.fail('late commit callback')));
 release.resolve();await running;await f.node.execution.engine.drain([f.ids.a,f.ids.b]);assert.equal(f.node.execution.engine.get(f.ids.a)?.state,'cancelled');assert.equal(f.node.execution.engine.get(f.ids.b)?.state,'succeeded');assert.equal(f.committed.includes(f.ids.a),false);assert.equal(f.committed.filter(x=>x===f.ids.b).length,1);
 f.state.executeHook=undefined;f.db.exec('CREATE TABLE generated_joined_outputs(user_id TEXT,value TEXT)');
 f.state.commitHook=run=>{if(run.task.input.label==='self-revoke'){f.db.prepare('INSERT INTO generated_joined_outputs VALUES(?,?)').run(run.context.userId,'rollback');f.db.prepare('UPDATE task_authorizations SET revoked=1 WHERE task_id=?').run(run.task.id);}};
 const self=await f.submit(f.a.token,'self-revoke');await f.node.execution.engine.drain([self]);assert.equal(f.node.execution.engine.get(self)?.state,'stale');assert.equal(f.db.prepare('SELECT count(*) n FROM generated_joined_outputs').get()!.n,0);assert.equal(f.db.prepare('SELECT revoked FROM task_authorizations WHERE task_id=?').get(self)!.revoked,0,'postcommit recheck rolls back revocation and output together');
 f.state.commitHook=undefined;f.state.executeHook=async run=>{const sql=new PrivateSql(f.db,run.context.userId,()=>f.node.authority.assert(run.context));run.grant.commit(()=>{assert.throws(()=>sql.transaction(()=>{sql.run('INSERT INTO generated_joined_outputs(user_id,value) VALUES($user,?)','inner');throw Error('generated nested failure');}),/generated nested failure/);sql.run('INSERT INTO generated_joined_outputs(user_id,value) VALUES($user,?)','outer');});};
 const nested=await f.submit(f.a.token,'nested');await f.node.execution.engine.drain([nested]);assert.equal(f.node.execution.engine.get(nested)?.state,'succeeded');assert.deepEqual(f.db.prepare('SELECT value FROM generated_joined_outputs').all().map(r=>r.value),['outer']);
});

test('task authorization initializes before task schema and account close remains owned by Accounts',async t=>{
 const standaloneDb=new DatabaseSync(':memory:');try{const accounts=new Accounts(standaloneDb,'generated-standalone-deployment'),grants=new TaskAuthorization(standaloneDb,accounts,'generated-standalone-deployment');assert.throws(()=>grants.assert('generated-missing'),{code:'invalid_identity'});assert.equal(standaloneDb.prepare("SELECT 1 FROM sqlite_schema WHERE name='user_tasks'").get(),undefined);}finally{standaloneDb.close();}
 const f=await fixture(t);assert.equal(f.current(),true);f.node.accounts!.close();assert.equal(f.current(),false);assert.throws(()=>f.grants.assert(f.ownerA.grantId!),{code:'invalid_identity'});assert.throws(()=>f.node.accounts!.assertAccountEnabled(f.ownerA.userId,f.ownerA.authorizationEpoch),{code:'invalid_identity'});
 // The production construction order was exercised above. Removing later task
 // tables here confirms the independent grant API does not prepare the new join.
 changed(f.db,()=>f.db.exec('ALTER TABLE user_tasks RENAME TO generated_saved_tasks'),()=>assert.throws(()=>f.grants.assert(f.ownerA.grantId!),{code:'invalid_identity'}));
});

test('real composed input authority benchmark',async t=>{
 const mode=process.env.MOTE_JOINED_PROOF_BENCH,measured=mode==='plain'||mode==='count',count=mode==='count';
 const f=await fixture(t,{count,large:true}),db=f.db;
 const connection={journalMode:db.prepare('PRAGMA journal_mode').get()!.journal_mode,synchronous:db.prepare('PRAGMA synchronous').get()!.synchronous,isTransaction:db.isTransaction};assert.equal(connection.isTransaction,false);
 for(let n=0;n<20;n++)assert.equal(f.current(),true);
 const blocks:{calls:number;wallMs:number;userMs:number;systemMs:number;validateCallbacks:number}[]=[],iterations=measured?100:20;
 for(let block=0;block<(mode==='plain'?5:1);block++){
  const callbacks=f.state.validateCalls;f.observer?.start();const cpu=process.cpuUsage(),start=performance.now();
  for(let n=0;n<iterations;n++)assert.equal(f.current(),true);
  const wallMs=performance.now()-start,used=process.cpuUsage(cpu),counts=f.observer?.stop();
  assert.equal(f.state.validateCalls-callbacks,iterations);blocks.push({calls:iterations,wallMs,userMs:used.user/1000,systemMs:used.system/1000,validateCallbacks:f.state.validateCalls-callbacks});
  if(counts){const c=counts.get,joined=c.joined??0;assert.equal(counts.errors,0);assert.equal(counts.overflow,0);assert.equal(counts.run,0);assert.equal(counts.all,0);assert.equal(counts.iterate,0);assert.equal(c.account,2*iterations);assert.equal(c.model,iterations);assert.equal(c.other,iterations);
   if(joined){assert.equal(joined,2*iterations);assert.equal(c.task??0,0);assert.equal(c.lifecycle??0,0);assert.equal(c.grant??0,0);}else{for(const key of ['task','lifecycle','grant'])assert.equal(c[key],2*iterations);}
   t.diagnostic(JSON.stringify({benchmark:'composed-input-authority-count',connection,iterations,logicalValidCalls:2*iterations,counts}));
  }
 }
 assert.equal(f.current(f.ids.b),true);assert.equal(f.executed.length,0);await f.finish();
 if(measured)t.diagnostic(JSON.stringify({benchmark:'composed-input-authority-plain',mode,connection,payloadBytes:256*1024,tasks:2,blocks}));
});
