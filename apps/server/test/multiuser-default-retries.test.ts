import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {spawn,type ChildProcess} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {ProviderFailure} from '@mote/shared';
import {buildApp} from '../src/app.js';
import {defaultModelDomain,defaultModelSettings} from '../src/model-settings.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import type {UserTaskHandler} from '../src/scope/task-execution.js';
const protocol={'x-mote-protocol-version':'2'},password='Generated-default-retry-password-01';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
const handler=(execute:UserTaskHandler['execute']):UserTaskHandler=>({kind:'generated.read-query',pool:'generated.read-query',concurrency:()=>2,policy:EXECUTION_POLICIES.modelCall,modelFeature:'memory',modelAdmission:'per-call',unknownRecovery:'read-query',parseInput:()=>({}),execute});
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-default-retry-http-')),nodes:Awaited<ReturnType<typeof buildApp>>[]=[],cleanup:(()=>void)[]=[];let node=await buildApp({dataDir:directory});nodes.push(node);
 t.after(async()=>{cleanup.forEach(work=>work());await Promise.all(nodes.map(n=>n.app.close()));rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-retry-owner',password);const login=await node.app.inject({method:'POST',url:'/api/auth/login',headers:protocol,payload:{username:'generated-retry-owner',password,mode:'client'}});assert.equal(login.statusCode,200,login.body);const owner=login.json();
 const request=(method:'GET'|'POST'|'PUT',url:string,payload?:unknown,target=node)=>target.app.inject({method,url,headers:{...protocol,authorization:'Bearer '+owner.token},...(payload===undefined?{}:{payload})});
 const tier=async(serviceTier:'fast'|'default')=>{const value={...defaultModelDomain(),deployment:{...defaultModelSettings(),provider:'codex',protocol:'codex-app-server' as const,baseUrl:'',model:'gpt-6.1-sol',reasoningEffort:'high' as const,modelRequestTimeoutMs:null,agentTimeoutMs:null,serviceTier}};const response=await request('PUT','/api/admin/configuration/models',{revision:node.configuration.instance.revision,value});assert.equal(response.statusCode,200,response.body);};
 await tier('fast');const configuration=(await request('GET','/api/configuration')).json(),saved=await request('PUT','/api/configuration/models',{revision:configuration.revision,value:{profiles:[],selections:{memory:{kind:'shared',id:'env:deployment'}}}});assert.equal(saved.statusCode,200,saved.body);
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'));try{return work(db);}finally{db.close();}};
 const submit=async(operationId='generated-operation')=>{const response=await request('POST','/api/tasks',{kind:'generated.read-query',operationId,input:{}});assert.equal(response.statusCode,200,response.body);return response.json();};
 const task=async(id:string,target=node)=>(await request('GET','/api/tasks/'+id,undefined,target)).json();
 return {directory,owner,get node(){return node;},request,tier,read,submit,task,cleanup,second:async()=>{const next=await buildApp({dataDir:directory});nodes.push(next);return next;},restart:async()=>{await node.app.close();node=await buildApp({dataDir:directory});nodes.push(node);}};
}

test('formal same-task automatic read recovery preserves unknown history and derives only an ordinary retry snapshot',async t=>{
 const f=await fixture(t),seen:{tier:string|undefined;snapshotId:string}[]=[];
 f.node.execution!.register(handler(async run=>run.model!.withModel(async settings=>{seen.push({tier:settings.serviceTier,snapshotId:run.model!.lease.snapshotId});run.external.begin('generated-read-'+seen.length);if(seen.length===1)throw new ProviderFailure({category:'transient',code:'provider_network',retryAfterMs:60000});run.external.complete();return {retained:true};},{recovery:'read-query'})));
 const submitted=await f.submit();await f.node.execution!.engine.drain([submitted.id]);let task=await f.task(submitted.id);assert.equal(task.state,'waiting');assert.equal(task.attempts,1);assert.equal(seen.length,1);
 const before=f.read(db=>String(db.prepare('SELECT model_receipt FROM user_tasks WHERE task_id=?').get(task.id)!.model_receipt));await f.tier('default');
 f.read(db=>db.prepare('UPDATE execution_steps SET available_at=0 WHERE id=?').run(task.id));await f.node.execution!.engine.drain([task.id]);task=await f.task(task.id);
 assert.equal(task.state,'succeeded');assert.equal(task.attempts,2);assert.equal(task.externalState,'succeeded');assert.equal(task.externalUnresolved,1);assert.deepEqual(seen.map(s=>s.tier),['fast','default']);assert.notEqual(seen[0].snapshotId,seen[1].snapshotId);
 const calls=f.read(db=>db.prepare('SELECT state,settled_at FROM task_external_calls WHERE task_id=? ORDER BY issued_at,rowid').all(task.id));assert.equal(calls.length,2);assert.equal(calls[0].state,'unknown');assert.equal(calls[0].settled_at,null);assert.equal(calls[1].state,'succeeded');
 assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_policy_replays WHERE user_id=?').get(f.owner.userId)!.n),1);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_retry_confirmations').get()!.n),0);
 const {attemptId:initialAttempt,...originalReceipt}=JSON.parse(before);assert.ok(initialAttempt);assert.deepEqual(JSON.parse(String(f.read(db=>db.prepare('SELECT receipt FROM task_model_attempts WHERE task_id=? AND attempt_id=?').get(task.id,'snapshot:'+seen[0].snapshotId)!.receipt))),originalReceipt);
 const context=await f.node.authority.authenticate(f.owner.token),old=await f.node.configuration.restoreLease(context,seen[0].snapshotId,submitted.operationId);assert.equal(old.status,'restored');if(old.status==='restored')await f.node.configuration.withModel(old.lease,async settings=>assert.equal(settings.serviceTier,'fast'));
 await f.restart();const restored=await f.node.configuration.restoreLease(await f.node.authority.authenticate(f.owner.token),seen[1].snapshotId,submitted.operationId);assert.equal(restored.status,'restored');if(restored.status==='restored')await f.node.configuration.withModel(restored.lease,async settings=>assert.equal(settings.serviceTier,'default'));
 assert.equal((await f.task(task.id)).externalUnresolved,1,'restart must not invent settlement of the old unknown');
});

test('three ambiguous read attempts exhaust the finite round without fabricating owner confirmations',async t=>{
 const f=await fixture(t);let calls=0;f.node.execution!.register(handler(async run=>run.model!.withModel(async()=>{run.external.begin('generated-read-'+(++calls));throw new ProviderFailure({category:'transient',code:'provider_network',retryAfterMs:0});},{recovery:'read-query'})));
 const submitted=await f.submit();await f.node.execution!.engine.drain([submitted.id]);const task=await f.task(submitted.id);assert.equal(calls,3);assert.equal(task.state,'failed');assert.equal(task.attempts,3);assert.equal(task.maxAttempts,3);assert.equal(task.retryExhausted,true);assert.equal(task.externalUnresolved,3);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_policy_replays').get()!.n),2);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_retry_confirmations').get()!.n),0);
 await f.node.execution!.engine.drain([task.id]);assert.equal(calls,3);
});

test('a still-live generated child blocks a second M05 instance after lease expiry until exact callback cleanup',async t=>{
 const f=await fixture(t),entered=deferred();let child:ChildProcess|undefined,closed:Promise<void>|undefined,calls=0;
 f.cleanup.push(()=>child?.kill('SIGKILL'));
 const execute:UserTaskHandler['execute']=async run=>run.model!.withModel(async()=>{const count=++calls;run.external.begin('generated-child-'+count);if(count===1){child=spawn(process.execPath,['-e',"process.on('message',()=>process.exit(0));process.send('ready');"],{stdio:['ignore','ignore','pipe','ipc']});closed=new Promise<void>(resolve=>child!.once('close',()=>resolve()));await new Promise<void>((resolve,reject)=>{child!.once('message',()=>resolve());child!.once('error',reject);});entered.resolve();await closed;}run.external.complete();return null;},{recovery:'read-query'});
 f.node.execution!.register(handler(execute));const submitted=await f.submit(),running=f.node.execution!.engine.drain([submitted.id]);await entered.promise;
 const second=await f.second();second.execution!.register(handler(execute));f.read(db=>db.prepare('UPDATE execution_steps SET lease_until=0 WHERE id=?').run(submitted.id));await second.execution!.engine.drain([submitted.id]);assert.equal(calls,1);assert.equal((await f.task(submitted.id,second)).attempts,1);assert.equal((await f.task(submitted.id,second)).error,'physical_cleanup_pending');assert.equal(child!.exitCode,null);
 child!.send('finish');await closed;await running;const deadline=Date.now()+10000;while((await f.task(submitted.id,second)).state!=='succeeded'){assert.ok(Date.now()<deadline);f.read(db=>db.prepare('UPDATE execution_steps SET available_at=0 WHERE id=? AND state=\'waiting\'').run(submitted.id));await second.execution!.engine.drain([submitted.id]);await delay(5);}
 assert.equal(calls,2);assert.equal((await f.task(submitted.id,second)).attempts,2);assert.equal(f.read(db=>db.prepare("SELECT count(*) n FROM task_physical_calls WHERE state='active'").get()!.n),0);assert.equal((await f.task(submitted.id,second)).externalUnresolved,1);
});

test('ordinary retry derivation cannot revive a withdrawn shared connection',async t=>{
 const f=await fixture(t),context=await f.node.authority.authenticate(f.owner.token),lease=await f.node.configuration.forUser(context).lease('memory','generated-revoked-operation');
 const value={...defaultModelDomain(),deployment:defaultModelSettings()},response=await f.request('PUT','/api/admin/configuration/models',{revision:f.node.configuration.instance.revision,value});assert.equal(response.statusCode,200,response.body);await f.tier('default');await assert.rejects(f.node.configuration.deriveRetryLease(context,lease.snapshotId,lease.operationId));
});

test('one explicit owner group freezes its exact children and survives parent replay/restart without another budget reset',async t=>{
 const f=await fixture(t);let calls=0,attached=0;
 const failed=handler(async run=>run.model!.withModel(async()=>{calls++;throw new ProviderFailure({category:'transient',code:'provider_network',retryAfterMs:0});},{recovery:'read-query'}));
 const parent:UserTaskHandler={kind:'generated.owner-command',pool:'generated.owner-command',concurrency:()=>1,policy:EXECUTION_POLICIES.control,parseInput:raw=>raw as Record<string,unknown>,execute:async run=>{
  const service=f.node.execution!.forUser(run.context);if(service.retryGroupRead(run.task.id)===undefined){run.grant.commit(()=>service.retryGroup(run.task.id,run.task.input.ids as string[],()=>{attached++;}));if(run.task.input.pause)throw new ExecutionFailure('transient','generated_parent_resume',60000);}return {frozen:service.retryGroupRead(run.task.id)};
 }};
 f.node.execution!.register(failed);f.node.execution!.register(parent);const child=await f.submit('generated-group-child');await f.node.execution!.engine.drain([child.id]);assert.equal(calls,3);
 const command=await f.request('POST','/api/tasks',{kind:parent.kind,operationId:'generated-owner-command',input:{ids:[child.id],pause:true}});assert.equal(command.statusCode,200,command.body);await f.node.execution!.engine.drain([command.json().id]);await f.node.execution!.engine.drain([child.id]);assert.equal(calls,6);assert.equal((await f.task(child.id)).retryRound,2);assert.equal(attached,1);
 await f.restart();f.node.execution!.register(failed);f.node.execution!.register(parent);f.read(db=>db.prepare('UPDATE execution_steps SET available_at=0 WHERE id=?').run(command.json().id));await f.node.execution!.engine.drain([command.json().id]);await f.node.execution!.engine.drain([child.id]);assert.equal((await f.task(command.json().id)).state,'succeeded');assert.equal(calls,6);assert.equal((await f.task(child.id)).retryRound,2);assert.equal(attached,1);
 const next=await f.request('POST','/api/tasks',{kind:parent.kind,operationId:'generated-new-owner-command',input:{ids:[child.id],pause:false}});assert.equal(next.statusCode,200,next.body);await f.node.execution!.engine.drain([next.json().id]);await f.node.execution!.engine.drain([child.id]);assert.equal(calls,9);assert.equal((await f.task(child.id)).retryRound,3);assert.equal(attached,2);
});

test('an invalid exact child rolls membership, frozen group and earlier child round changes back atomically',async t=>{
 const f=await fixture(t),db=f.node.execution!.engine.store.db;db.exec('CREATE TABLE generated_retry_memberships(parent TEXT,child TEXT)');
 f.node.execution!.register(handler(async()=>{throw new ExecutionFailure('blocked','generated_prerequisite');}));const child=await f.submit('generated-atomic-child');await f.node.execution!.engine.drain([child.id]);const before=await f.task(child.id);
 const kind='generated.atomic-owner-command';f.node.execution!.register({kind,pool:kind,concurrency:()=>1,policy:EXECUTION_POLICIES.control,parseInput:()=>({}),execute:async run=>{run.grant.commit(()=>f.node.execution!.forUser(run.context).retryGroup(run.task.id,[child.id],()=>{db.prepare('INSERT INTO generated_retry_memberships VALUES(?,?)').run(run.task.id,child.id);throw new ExecutionFailure('permanent','generated_group_attachment_failed');}));return null;}});
 const command=await f.request('POST','/api/tasks',{kind,operationId:'generated-failed-owner-command',input:{}});assert.equal(command.statusCode,200,command.body);await f.node.execution!.engine.drain([command.json().id]);assert.equal((await f.task(command.json().id)).state,'failed');assert.deepEqual(await f.task(child.id),before);assert.equal(db.prepare('SELECT count(*) n FROM generated_retry_memberships').get()!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM task_owner_retry_groups').get()!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM task_owner_retry_targets').get()!.n,0);
});

test('a pre-tracking declared read still needs its exact explicit unknown acknowledgment before owner recovery',async t=>{
 const f=await fixture(t);let calls=0;const kind='generated.pre-tracking-read';f.node.execution!.register({kind,pool:kind,concurrency:()=>1,policy:EXECUTION_POLICIES.modelCall,unknownRecovery:'read-query',parseInput:()=>({}),execute:async run=>{run.external.begin('generated-legacy-'+(++calls));if(calls===1)throw new ExecutionFailure('blocked','external_result_unknown');run.external.complete();return null;}});
 const submitted=await f.request('POST','/api/tasks',{kind,operationId:'generated-legacy-read',input:{}});assert.equal(submitted.statusCode,200,submitted.body);const id=submitted.json().id;await f.node.execution!.engine.drain([id]);const before=await f.task(id);assert.equal(before.confirmUnknownRequired,true);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_physical_calls WHERE task_id=?').get(id)!.n),0);
 const rejected=await f.request('POST','/api/tasks/'+id+'/retry',{});assert.equal(rejected.statusCode,409,rejected.body);assert.deepEqual(await f.task(id),before);assert.equal(calls,1);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_retry_confirmations').get()!.n),0);
 const accepted=await f.request('POST','/api/tasks/'+id+'/retry',{confirmUnknown:true});assert.equal(accepted.statusCode,200,accepted.body);await f.node.execution!.engine.drain([id]);assert.equal((await f.task(id)).state,'succeeded');assert.equal((await f.task(id)).externalUnresolved,1);assert.equal(calls,2);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_retry_confirmations').get()!.n),1);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_policy_replays').get()!.n),0);
});

test('read replacement authorizes only its exact quiescent historical call without owner ACKs or new charged work',async t=>{
 const f=await fixture(t);let calls=0;f.node.execution!.register(handler(async run=>run.model!.withModel(async()=>{run.external.begin('generated-read-'+(++calls));throw new ProviderFailure({category:'transient',code:'provider_network',retryAfterMs:0});},{recovery:'read-query'})));
 const submitted=await f.submit('generated-read-replacement');await f.node.execution!.engine.drain([submitted.id]);assert.equal(calls,3);const task=await f.task(submitted.id),before=f.read(db=>db.prepare('SELECT * FROM task_external_calls WHERE task_id=? ORDER BY issuance_id').all(task.id)),context=await f.node.authority.authenticate(f.owner.token);
 f.node.execution!.authorizeReadReplacement(context,task.id,'generated-owner-replacement');f.node.execution!.authorizeReadReplacement(context,task.id,'generated-owner-replacement');assert.equal(calls,3);assert.deepEqual(await f.task(task.id),task);assert.deepEqual(f.read(db=>db.prepare('SELECT * FROM task_external_calls WHERE task_id=? ORDER BY issuance_id').all(task.id)),before);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_retry_confirmations').get()!.n),0);
 const events=f.read(db=>db.prepare('SELECT p.*,c.attempt,physical.attempt_id physical_attempt FROM task_external_policy_replays p JOIN task_external_calls c ON c.issuance_id=p.issuance_id JOIN task_physical_calls physical ON physical.issuance_id=c.issuance_id WHERE p.user_id=?').all(f.owner.userId));assert.equal(events.length,3);const replacement=events.filter(e=>e.replacement_command!==null);assert.equal(replacement.length,1);assert.equal(replacement[0].attempt_id,replacement[0].physical_attempt);assert.equal(replacement[0].attempt,3);
});

test('replacement cannot turn an unknown effect or missing physical history into a policy event',async t=>{
 const f=await fixture(t);let calls=0;f.node.execution!.register(handler(async run=>run.model!.withModel(async()=>{run.external.begin('generated-effect-'+(++calls));throw new ProviderFailure({category:'transient',code:'provider_network',retryAfterMs:0});})));
 const submitted=await f.submit('generated-effect-replacement');await f.node.execution!.engine.drain([submitted.id]);const before=await f.task(submitted.id),context=await f.node.authority.authenticate(f.owner.token);assert.equal(calls,1);assert.equal(before.confirmUnknownRequired,true);assert.throws(()=>f.node.execution!.authorizeReadReplacement(context,submitted.id,'generated-forbidden-replacement'),{code:'external_result_unknown'});assert.deepEqual(await f.task(submitted.id),before);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_policy_replays').get()!.n),0);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_retry_confirmations').get()!.n),0);
 // Negative historical-pointer control: losing a current pointer must not
 // silently authorize an older actual effect issuance.
 f.read(db=>db.prepare("UPDATE user_tasks SET external_state='succeeded',external_issuance=NULL,external_key=NULL WHERE task_id=?").run(submitted.id));assert.throws(()=>f.node.execution!.authorizeReadReplacement(context,submitted.id,'generated-history-gap'),{code:'external_result_unknown'});assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_policy_replays').get()!.n),0);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_retry_confirmations').get()!.n),0);
});
