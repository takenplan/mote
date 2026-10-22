import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {UserContextAuthority,type VerifiedIdentity} from '../src/scope/context.js';
import {LifecycleAuthority} from '../src/scope/lifecycle.js';
import {ScopedServices} from '../src/scope/services.js';
import {TaskAuthorization} from '../src/scope/task-authorization.js';
import {TaskExecution} from '../src/scope/task-execution.js';
import type {Accounts} from '../src/scope/accounts.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {processingConfigurationInput,processingConfigurationReceipt,processingConfigurationChanged} from '../src/scope/processing-configuration-intent.js';

test('processing receipt ignores unrelated revisions and never revives an earlier A incarnation',()=>{
 const facts={processing:{generation:1},perception:'generated',filePolicy:{}};
 assert.equal(processingConfigurationChanged(facts,structuredClone(facts)),false);
 const first=processingConfigurationReceipt('a',1,1,facts,true),second=processingConfigurationReceipt('a',1,2,{...facts,perception:'B'},true),third=processingConfigurationReceipt('a',1,3,facts,true);
 assert.notEqual(first.id,third.id);assert.notEqual(first.id,second.id);assert.notEqual(first.id,processingConfigurationReceipt('b',1,1,facts,true).id);
});
async function fixture(t:any){
 const db=new DatabaseSync(':memory:');let live=true,epoch=1;const identity:VerifiedIdentity={deploymentId:'generated-host',userId:'generated-a',credentialId:'generated-session',authorizationEpoch:1,administrator:false},accounts={assertAccountEnabled:(user:string,current:number)=>{if(user!==identity.userId||current!==epoch)throw Error('generated epoch retired');}} as Accounts,grants=new TaskAuthorization(db,accounts,identity.deploymentId),authority=new UserContextAuthority(identity.deploymentId,{verify:async()=>identity,isCurrent:()=>live},grants),lifecycle=new LifecycleAuthority(identity.deploymentId,{verify:async()=>({deploymentId:identity.deploymentId,userId:identity.userId,domain:'processing',purpose:'delete',operationId:'generated-processing-delete'}),isCurrent:()=>true}),services=new ScopedServices(authority,lifecycle),execution=new TaskExecution(db,authority,services,grants),context=await authority.authenticate('generated');
 const input=z.object({originalRef:z.string(),configurationIntentId:z.string().optional(),intentTaskId:z.string().optional(),plugin:z.unknown().optional()}).strict();let executions=0,childIntent:string|undefined;
 execution.register({kind:'processing.pipeline',pool:'generated-pipeline',concurrency:()=>0,policy:EXECUTION_POLICIES.orchestration,parseInput:raw=>input.parse(raw),execute:async()=>{executions++;return null;}});
 execution.engine.configurePool('generated-pipeline',{lane:()=> 'background',concurrency:{background:()=>1,interactive:()=>1},available:()=>false});
 execution.register({kind:'processing.configuration',pool:'generated-config',concurrency:()=>1,policy:EXECUTION_POLICIES.control,parseInput:raw=>processingConfigurationInput.parse(raw),execute:async run=>{const command=processingConfigurationInput.parse(run.task.input),child=execution.forUser(run.context).submitSync({kind:'processing.pipeline',operationId:'replacement:'+run.task.id,input:{originalRef:command.originalRef,configurationIntentId:run.task.id,...(childIntent?{intentTaskId:childIntent}:{})}});execution.bindProcessingConfigurationReplacement(run.context,run.task.id,child.id);return {id:child.id};}});
 t.after(async()=>{await execution.close();db.close();});
 const root=()=>execution.forUser(context).submitSync({kind:'processing.pipeline',operationId:'original',input:{originalRef:'original:'+'a'.repeat(64)}});
 const receipt=(id='b')=>({receiptId:id.repeat(64),preserveImagePlan:true});
 return {db,grants,authority,execution,lifecycle,context,root,receipt,childIntent:(id:string)=>{childIntent=id;},logout:()=>{live=false;},retire:()=>{epoch++;},executions:()=>executions};
}
test('fixed handoff derives a fresh real grant after logout and cannot be publicly submitted',async t=>{
 const f=await fixture(t),root=f.root();assert.throws(()=>f.execution.forUser(f.context).submitSync({kind:'processing.configuration',operationId:'forged',input:{}}),{code:'task_handler_unavailable'});
 const handoff=f.execution.handoffProcessingConfiguration(root.id,f.receipt(),()=>true)!;f.logout();assert.equal(f.execution.engine.get(root.id)!.state,'cancelled');assert.equal(f.execution.processingConfigurationIntent(handoff.id)?.root.id,root.id);
 await f.execution.tick();await f.execution.engine.drain([handoff.id]);assert.equal(f.execution.engine.get(handoff.id)!.state,'succeeded');const link=f.db.prepare('SELECT replacement_id FROM task_processing_config_handoffs WHERE task_id=?').get(handoff.id)!;assert.ok(link.replacement_id);assert.equal(f.execution.engine.get(String(link.replacement_id))!.kind,'processing.pipeline');assert.equal(f.executions(),0);
});
test('atomic rollback after real enqueue preserves prior grant and causes zero local abort',async t=>{
 const f=await fixture(t),root=f.root();let handoff:string|undefined,aborts=0;const abort=f.execution.engine.abortLocal.bind(f.execution.engine);f.execution.engine.abortLocal=id=>{aborts++;abort(id);};
 f.db.exec('BEGIN');handoff=f.execution.handoffProcessingConfiguration(root.id,f.receipt(),()=>true)!.id;assert.equal(f.execution.engine.get(root.id)!.state,'cancelled');f.db.exec('ROLLBACK');
 assert.equal(f.execution.engine.get(handoff),undefined);assert.equal(f.execution.engine.get(root.id)!.state,'waiting');f.grants.assertExecutionTaskIdentity(f.execution.engine.get(root.id)!);assert.equal(aborts,0);assert.equal(f.db.prepare('SELECT count(*) n FROM task_processing_config_handoffs').get()!.n,0);
});
test('rapid configuration replaces pending handoff through exact cancellation ancestry',async t=>{
 const f=await fixture(t),root=f.root(),first=f.execution.handoffProcessingConfiguration(root.id,f.receipt(),()=>true)!,second=f.execution.handoffProcessingConfiguration(root.id,f.receipt('c'),()=>true)!;
 assert.notEqual(first.id,second.id);assert.equal(f.execution.engine.get(first.id)!.state,'cancelled');assert.equal(f.execution.processingConfigurationIntent(second.id)?.root.id,root.id);
 f.db.prepare('DELETE FROM task_processing_config_retirements WHERE handoff_id=? AND task_id=?').run(second.id,first.id);assert.equal(f.execution.processingConfigurationIntent(second.id),undefined);
});
test('arbitrary cancel, revoked ancestor, wrong epoch, copied input and plugin roots cannot grant work',async t=>{
 const f=await fixture(t),root=f.root();f.execution.forUser(f.context).cancel(root.id);assert.equal(f.execution.handoffProcessingConfiguration(root.id,f.receipt(),()=>true),undefined);
 const other=f.execution.forUser(f.context).submitSync({kind:'processing.pipeline',operationId:'other',input:{originalRef:'original:'+'a'.repeat(64)}}),handoff=f.execution.handoffProcessingConfiguration(other.id,f.receipt(),()=>true)!;
 assert.throws(()=>f.execution.assertProcessingConfigurationInput(f.context,handoff.id,'original:'+'a'.repeat(64)),{code:'invalid_identity'});
 f.grants.revoke(other.id);assert.equal(f.execution.processingConfigurationIntent(handoff.id),undefined);
 const plugin=f.execution.forUser(f.context).submitSync({kind:'processing.pipeline',operationId:'plugin',input:{originalRef:'original:'+'a'.repeat(64),plugin:{}}});assert.equal(f.execution.handoffProcessingConfiguration(plugin.id,f.receipt(),()=>true),undefined);
 f.retire();assert.throws(()=>f.execution.handoffProcessingConfiguration(plugin.id,f.receipt(),()=>true));
});

test('shared recheck and configuration ancestry may converge without hiding a revoked upstream grant',async t=>{
 const f=await fixture(t),upstream=f.root();f.execution.engine.fail(upstream.id,'model_missing');
 f.execution.register({kind:'processing.recheck',pool:'generated-recheck',concurrency:()=>1,policy:EXECUTION_POLICIES.control,parseInput:raw=>z.object({intentId:z.string(),stamp:z.number()}).parse(raw),execute:async run=>f.execution.forUser(run.context).submitSync({kind:'processing.pipeline',operationId:'shared:'+run.task.id,input:{originalRef:'original:'+'a'.repeat(64),intentTaskId:upstream.id}})});
 f.execution.handoffProcessingRechecks(1,()=>true);const recheck=String(f.db.prepare("SELECT id FROM execution_steps WHERE kind='processing.recheck'").get()!.id);await f.execution.tick();await f.execution.engine.drain([recheck]);
 const shared=String(f.db.prepare("SELECT task_id FROM user_tasks WHERE json_extract(input,'$.intentTaskId')=?").get(upstream.id)!.task_id);f.childIntent(upstream.id);
 const first=f.execution.handoffProcessingConfiguration(shared,f.receipt(),()=>true)!;await f.execution.tick();await f.execution.engine.drain([first.id]);assert.equal(f.execution.engine.get(first.id)!.state,'succeeded');
 const child=String(f.db.prepare('SELECT replacement_id FROM task_processing_config_handoffs WHERE task_id=?').get(first.id)!.replacement_id),second=f.execution.handoffProcessingConfiguration(child,f.receipt('c'),()=>true)!;
 assert.ok(second);assert.equal(f.execution.processingConfigurationIntent(second.id)?.root.id,child);
 f.grants.revoke(upstream.id);assert.equal(f.execution.processingConfigurationIntent(second.id),undefined);
});
test('a real persisted ancestry cycle is rejected even with matching row and root hashes',async t=>{
 const f=await fixture(t),root=f.root(),handoff=f.execution.handoffProcessingConfiguration(root.id,f.receipt(),()=>true)!,input={intentTaskId:root.id,originalRef:'original:'+'a'.repeat(64)},encoded=JSON.stringify(input);
 f.db.prepare('UPDATE user_tasks SET input=? WHERE task_id=?').run(encoded,root.id);f.db.prepare('UPDATE execution_steps SET input=? WHERE id=?').run(encoded,root.id);f.db.prepare('UPDATE task_processing_config_handoffs SET root_hash=? WHERE root_id=?').run(createHash('sha256').update(encoded).digest('hex'),root.id);
 assert.equal(f.execution.processingConfigurationIntent(handoff.id),undefined);
});

test('processing lifecycle purge retains inert ancestry for exact unresolved calls and then cascades links without granting work',async t=>{
 const f=await fixture(t),root=f.root(),handoff=f.execution.handoffProcessingConfiguration(root.id,f.receipt(),()=>true)!,subject=await f.lifecycle.authorize('generated-delete');f.db.exec('PRAGMA foreign_keys=ON');
 assert.throws(()=>f.execution.purgeProcessingConfiguration(f.context),{code:'invalid_identity'});
 f.db.prepare("INSERT INTO task_external_calls VALUES('generated-unknown',?,?,'generated-request','unknown',1,1,1,NULL)").run(root.id,f.context.userId);
 const before=f.db.prepare('SELECT * FROM task_processing_config_handoffs').all();assert.equal(f.execution.purgeProcessingConfiguration(subject),false);assert.deepEqual(f.db.prepare('SELECT * FROM task_processing_config_handoffs').all(),before);
 assert.equal(f.db.prepare("SELECT state FROM task_external_calls WHERE issuance_id='generated-unknown'").get()!.state,'unknown');
 f.db.prepare("UPDATE task_external_calls SET state='succeeded',settled_at=2 WHERE issuance_id='generated-unknown'").run();f.db.prepare("UPDATE user_tasks SET external_state='unknown' WHERE task_id=?").run(root.id);assert.equal(f.execution.purgeProcessingConfiguration(subject),false,'aggregate unknown also retains inert links');
 f.db.prepare("UPDATE user_tasks SET external_state='none' WHERE task_id=?").run(root.id);assert.equal(f.execution.purgeProcessingConfiguration(subject),true);assert.equal(f.db.prepare('SELECT count(*) n FROM task_processing_config_handoffs').get()!.n,0);assert.equal(f.db.prepare('SELECT count(*) n FROM task_processing_config_retirements').get()!.n,0);assert.equal(f.db.prepare('SELECT revoked FROM task_authorizations WHERE task_id=?').get(handoff.id)!.revoked,1);assert.equal(f.execution.processingConfigurationIntent(handoff.id),undefined);
});
