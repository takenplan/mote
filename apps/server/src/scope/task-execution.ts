import {createHash} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {ExecutionEngine,ExecutionFailure,type ExecutionStep,type ExecutionGrant,type ExecutionFailureReceipt} from '../execution-engine.js';
import type {ModelFeature} from '@mote/shared/models';
import type {TaskModelHost,TaskModelLease,TaskModelConfiguration,TaskModelRun} from './task-model.js';
import type {ExecutionPolicy} from '../execution-policy.js';
import {randomUUID} from 'node:crypto';
import {linkOperation} from '../operation-projection.js';
import {Operations} from '../operations.js';
import type {ExecutionStorage} from '../execution-storage.js';
import {ScopeError} from './baseline.js';
import type {UserContext,UserContextAuthority} from './context.js';
import type {ScopedServices} from './services.js';
import {TaskAuthorization} from './task-authorization.js';
import type {DomainLifecycle,UserDataSubject,UserExport} from './lifecycle.js';

export const EXECUTION_DOMAIN='execution';
export class TaskError extends Error {constructor(readonly code:string,readonly statusCode=400){super(code);}}
const id=z.string().min(1).max(256);
const submitSchema=z.object({kind:id,operationId:id,input:z.record(z.unknown()),dependencies:z.array(id).max(100).default([])}).strict();
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json=(value:unknown)=>{const result=JSON.stringify(value);if(result===undefined||Buffer.byteLength(result)>32768)throw new TaskError('task_metadata_invalid',413);return result;};
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,canonical(value)])):value;
type TaskRow={task_id:string;user_id:string;grant_id:string;input:string;progress:string;checkpoints:string;result:string|null;external_state:string;external_key:string|null;model_receipt:string|null;external_issuance:string|null};
/** These capabilities are constructed by the host after resolving a durable
 * authorization. No request/model payload can supply a context or resource scope. */
export type TaskRun={context:UserContext;services:ReturnType<ScopedServices['forUser']>;task:ExecutionStep;signal:AbortSignal;grant:ExecutionGrant;model?:TaskModelRun;
 checkpoint:{read<T=unknown>(key:string):T|undefined;write(key:string,value:unknown):void};
 progress(value:unknown):void;
 external:{begin(key:string):string;complete():void};
};
export type UserTaskHandler={kind:string;pool:string;concurrency:()=>number;policy:ExecutionPolicy;
 modelFeature?:ModelFeature;
 parseInput:(input:unknown)=>Record<string,unknown>;
 resources?:(input:Record<string,unknown>)=>{scope:'user'|'shared';key:string}[];
 validate?:(task:ExecutionStep)=>boolean;
 admit?:(task:ExecutionStep)=>ExecutionFailure|undefined;
 execute:(run:TaskRun)=>Promise<unknown>;
 commit?:(run:TaskRun,result:unknown)=>void;
 classify?:(error:unknown)=>ExecutionFailure;
 /** Portable input must be explicitly credential-free; otherwise export omits
  * the payload and portable recovery stays unavailable for that task kind. */
 portableInput?:(input:Record<string,unknown>)=>Record<string,unknown>;
};

/** One shared ExecutionEngine and SQLite authority for all user task hosts. */
export class TaskExecution {
 readonly engine:ExecutionEngine;
 private readonly handlers=new Map<string,UserTaskHandler>();
 private readonly storage:ExecutionStorage;
 private modelHost:TaskModelHost|undefined;
 private readonly modelLeases=new Map<string,TaskModelLease>();
 private timer:ReturnType<typeof setInterval>|undefined;
 constructor(private readonly db:DatabaseSync,private readonly authority:UserContextAuthority,private readonly services:ScopedServices,private readonly grants:TaskAuthorization){
  db.exec(`CREATE TABLE IF NOT EXISTS user_tasks(task_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,grant_id TEXT NOT NULL UNIQUE,input TEXT NOT NULL,progress TEXT NOT NULL DEFAULT 'null',checkpoints TEXT NOT NULL DEFAULT '{}',result TEXT,external_state TEXT NOT NULL DEFAULT 'none',external_key TEXT,external_issuance TEXT,model_receipt TEXT,user_position INTEGER NOT NULL,UNIQUE(user_id,user_position));
   CREATE TABLE IF NOT EXISTS task_external_calls(issuance_id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES user_tasks(task_id) ON DELETE CASCADE,user_id TEXT NOT NULL,request_key TEXT NOT NULL,state TEXT NOT NULL,authorization_epoch INTEGER NOT NULL,attempt INTEGER NOT NULL,issued_at INTEGER NOT NULL,settled_at INTEGER);
   CREATE INDEX IF NOT EXISTS task_external_unsettled ON task_external_calls(user_id,state,task_id);
   CREATE TABLE IF NOT EXISTS task_external_retry_confirmations(confirmation_id TEXT PRIMARY KEY,issuance_id TEXT NOT NULL REFERENCES task_external_calls(issuance_id) ON DELETE CASCADE,user_id TEXT NOT NULL,authorization_epoch INTEGER NOT NULL,confirmed_at INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS user_tasks_owner ON user_tasks(user_id,task_id);
   CREATE TABLE IF NOT EXISTS task_lifecycle_state(user_id TEXT PRIMARY KEY,deleted INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS task_restore_journal(user_id TEXT NOT NULL,operation_id TEXT NOT NULL,payload_hash TEXT NOT NULL,PRIMARY KEY(user_id,operation_id));`);
  this.storage={db,reserveMetadata:bytes=>{if(!Number.isSafeInteger(bytes)||bytes<0)throw new TaskError('task_metadata_invalid');}};
  this.engine=new ExecutionEngine(this.storage);
 }
 /** The integration composition passes the existing M04 Configurations host. */
 bindConfiguration(host:TaskModelHost){if(this.modelHost&&this.modelHost!==host)throw new TaskError('model_host_conflict',409);this.modelHost=host;}
 private modelCurrent(step:ExecutionStep){const row=this.row(step.id);if(!row?.model_receipt)return true;const lease=this.modelLeases.get(step.id);if(!lease)return false;try{this.modelHost?.assertLease(lease);return Boolean(this.modelHost);}catch{return false;}}
 private transaction<T>(write:()=>T):T{const own=!this.db.isTransaction;if(own)this.db.exec('BEGIN IMMEDIATE');try{const value=write();if(own)this.db.exec('COMMIT');return value;}catch(error){if(own&&this.db.isTransaction)this.db.exec('ROLLBACK');throw error;}}
 private row(taskId:string){return this.db.prepare('SELECT * FROM user_tasks WHERE task_id=?').get(taskId) as TaskRow|undefined;}
 private enabled(userId:string){if(this.db.prepare('SELECT 1 FROM task_lifecycle_state WHERE user_id=? AND deleted=1').get(userId))throw new ScopeError('invalid_identity',401);}
 private assertTask(step:ExecutionStep){
  const row=this.row(step.id);if(!row||!step.ownership||row.user_id!==step.ownership.userId||row.grant_id!==step.ownership.grantId)throw new ScopeError('invalid_identity',401);
  this.enabled(row.user_id);if(this.grants.assert(row.grant_id,row.user_id,step.ownership.authorizationEpoch).task_id!==step.id)throw new ScopeError('invalid_identity',401);return row;
 }
 private valid(step:ExecutionStep){try{this.assertTask(step);return true;}catch{return false;}}
 register(handler:UserTaskHandler){
  if(this.handlers.has(handler.kind)||!handler.kind||!handler.pool||!handler.policy)throw new TaskError('task_handler_invalid',500);
  this.handlers.set(handler.kind,handler);
  const unregister=this.engine.register({kind:handler.kind,pool:handler.pool,concurrency:handler.concurrency,policy:handler.policy,
   validate:step=>this.valid(step)&&(handler.validate?.(step)??true),validateGrant:step=>this.valid(step)&&this.modelCurrent(step),
   resourceKeys:step=>(handler.resources?.(step.input)??[]).map(resource=>{if(!['user','shared'].includes(resource.scope)||typeof resource.key!=='string'||!resource.key||resource.key.length>256)throw new TaskError('task_resource_invalid');return JSON.stringify(resource.scope==='shared'?['shared',resource.key]:['user',step.ownership!.userId,resource.key]);}),
   admit:step=>{const row=this.assertTask(step);if(row.model_receipt&&!this.modelCurrent(step))return new ExecutionFailure('blocked',this.modelLeases.has(step.id)?'model_authority_revoked':'model_snapshot_unavailable');return ['issued','unknown'].includes(row.external_state)?new ExecutionFailure('blocked','external_result_unknown'):handler.admit?.(step);},
   execute:async(step,signal,grant)=>{
    const row=this.assertTask(step),context=await this.authority.restoreTask(row.grant_id);grant.assert();
    const write=(update:()=>void)=>grant.commit(()=>{this.assertTask(step);update();});
    const lease=this.modelLeases.get(step.id),model=lease&&this.modelHost?{lease,withModel:async<T>(work:Parameters<TaskModelHost['withModel']>[1])=>{grant.assert();try{return await this.modelHost!.withModel(lease,work) as T;}finally{grant.assert();}},recordUsage:(result:Parameters<TaskModelHost['recordUsage']>[1])=>grant.commit(()=>this.modelHost!.recordUsage(lease,result))}:undefined;
    const run:TaskRun={...(model?{model}:{}),context,services:this.services.forUser(context),task:step,signal,grant,
     checkpoint:{read:<T>(key:string)=>{grant.assert();const values=JSON.parse(this.row(step.id)!.checkpoints);return Object.hasOwn(values,key)?values[key] as T:undefined;},write:(key,value)=>{id.parse(key);write(()=>{const checkpoints=JSON.parse(this.row(step.id)!.checkpoints);Object.defineProperty(checkpoints,key,{value,enumerable:true,writable:true,configurable:true});this.db.prepare('UPDATE user_tasks SET checkpoints=? WHERE task_id=?').run(json(checkpoints),step.id);});}},
     progress:value=>write(()=>this.db.prepare('UPDATE user_tasks SET progress=? WHERE task_id=?').run(json(value),step.id)),
     external:{begin:key=>{id.parse(key);const issuanceId=randomUUID();write(()=>{const current=this.row(step.id)!;if(current.external_state!=='none')throw new ExecutionFailure('blocked','external_result_unknown');this.db.prepare("INSERT INTO task_external_calls VALUES(?,?,?,?,'issued',?,?,?,NULL)").run(issuanceId,step.id,current.user_id,key,step.ownership!.authorizationEpoch,step.attempts,Date.now());this.db.prepare("UPDATE user_tasks SET external_state='issued',external_key=?,external_issuance=? WHERE task_id=?").run(key,issuanceId,step.id);});return issuanceId;},complete:()=>write(()=>{const current=this.row(step.id)!;if(current.external_state!=='issued'||!current.external_issuance)throw new ExecutionFailure('permanent','external_call_not_issued');this.db.prepare("UPDATE task_external_calls SET state='succeeded',settled_at=? WHERE issuance_id=? AND task_id=? AND user_id=?").run(Date.now(),current.external_issuance,step.id,current.user_id);this.db.prepare("UPDATE user_tasks SET external_state='succeeded' WHERE task_id=?").run(step.id);})},
    };
    const result=await handler.execute(run);grant.assert();if(this.row(step.id)!.external_state==='issued')throw new ExecutionFailure('blocked','external_result_unknown');return {value:result,run};
   },
   commit:(step,result)=>{this.assertTask(step);const {run,value}=result as {run:TaskRun;value:unknown};this.authority.assert(run.context);handler.commit?.(run,value);this.db.prepare('UPDATE user_tasks SET result=? WHERE task_id=?').run(json(value??null),step.id);},
   project:step=>{if(step.state==='succeeded')this.modelLeases.delete(step.id);},
   classify:error=>error instanceof ExecutionFailure?error:handler.classify?.(error)??new ExecutionFailure('permanent','task_failed'),
  });
  return async()=>{await unregister();this.handlers.delete(handler.kind);};
 }
 forUser(context:UserContext){
  const assert=()=>{this.authority.assert(context);this.enabled(context.userId);};
  const owned=(taskId:string)=>{assert();const row=this.row(taskId);if(!row||row.user_id!==context.userId)throw new TaskError('task_not_found',404);return row;};
  return Object.freeze({
   submit:async(value:unknown)=>{
    assert();const request=submitSchema.parse(value),handler=this.handlers.get(request.kind);if(!handler)throw new TaskError('task_handler_unavailable',503);
    const input=canonical(handler.parseInput(request.input)) as Record<string,unknown>,encoded=json(input),operationId='task:'+hash([context.userId,request.operationId]),taskId=hash([context.userId,request.operationId,request.kind,input]);
    let modelLease:TaskModelLease|undefined;
    if(handler.modelFeature&&!this.row(taskId)){if(!this.modelHost)throw new TaskError('model_configuration_unavailable',503);modelLease=await this.services.forUser(context).get<TaskModelConfiguration>('configuration').lease(handler.modelFeature,operationId);assert();if(modelLease.userId!==context.userId||modelLease.deploymentId!==context.deploymentId||modelLease.operationId!==operationId||modelLease.feature!==handler.modelFeature)throw new ScopeError('invalid_identity',401);this.modelHost.assertLease(modelLease);}
    return this.transaction(()=>{assert();const prior=this.row(taskId);if(prior){this.assertTask(this.engine.get(taskId)!);const dependencies=this.db.prepare('SELECT dependency_id FROM execution_dependencies WHERE step_id=? ORDER BY dependency_id').all(taskId).map(row=>String(row.dependency_id));if(JSON.stringify(dependencies)!==JSON.stringify([...new Set(request.dependencies)].sort()))throw new TaskError('task_identity_conflict',409);return this.view(prior);}
     for(const dependency of request.dependencies)owned(dependency);
     const grantId=this.grants.issue(context,taskId);
     this.db.prepare('INSERT INTO user_tasks(task_id,user_id,grant_id,input,model_receipt,user_position) SELECT ?,?,?,?,?,coalesce(max(user_position),0)+1 FROM user_tasks WHERE user_id=?').run(taskId,context.userId,grantId,encoded,modelLease?json({id:modelLease.id,deploymentId:modelLease.deploymentId,userId:modelLease.userId,operationId:modelLease.operationId,feature:modelLease.feature,revision:modelLease.revision,instanceRevision:modelLease.instanceRevision,reference:modelLease.reference,provider:modelLease.provider,model:modelLease.model}):null,context.userId);
     this.engine.enqueue(operationId,handler.kind,input,{id:taskId,dependencies:request.dependencies,ownership:{userId:context.userId,authorizationEpoch:context.authorizationEpoch,grantId}});
     if(modelLease)this.modelLeases.set(taskId,modelLease);
     return this.view(this.row(taskId)!);
    });
   },
   get:(taskId:string)=>this.view(owned(taskId)),
   list:(args:{cursor?:number;limit?:number}={})=>{assert();const limit=Math.max(1,Math.min(args.limit??50,100)),rows=this.db.prepare('SELECT user_position,* FROM user_tasks WHERE user_id=? AND user_position>? ORDER BY user_position LIMIT ?').all(context.userId,args.cursor??0,limit+1) as (TaskRow&{user_position:number})[];return {items:rows.slice(0,limit).map(row=>this.view(row)),nextCursor:rows.length>limit?rows[limit-1].user_position:null};},
   cancel:(taskId:string)=>this.transaction(()=>{owned(taskId);this.engine.cancel(taskId);return this.view(this.row(taskId)!);}),
   retry:(taskId:string,options:{confirmUnknown?:boolean}={})=>this.transaction(()=>{const row=owned(taskId),step=this.engine.get(taskId)!;this.assertTask(step);if(step.state==='succeeded'||step.state==='running')throw new TaskError('task_retry_invalid',409);if(['issued','unknown'].includes(row.external_state)){if(!options.confirmUnknown)throw new TaskError('external_result_unknown',409);if(row.external_issuance){this.db.prepare("UPDATE task_external_calls SET state='unknown' WHERE issuance_id=? AND user_id=? AND state='issued'").run(row.external_issuance,context.userId);this.db.prepare('INSERT INTO task_external_retry_confirmations VALUES(?,?,?,?,?)').run(randomUUID(),row.external_issuance,context.userId,context.authorizationEpoch,Date.now());}this.db.prepare("UPDATE user_tasks SET external_state='none',external_key=NULL,external_issuance=NULL WHERE task_id=?").run(taskId);}this.engine.retry(taskId);return this.view(this.row(taskId)!);}),
   operations:()=>{assert();const operations=new Operations(this.storage,context.userId);return {page:(args:Parameters<Operations['page']>[0])=>{assert();return operations.page(args);},detail:(taskId:string,cursor?:number,limit?:number)=>{assert();return operations.detail(taskId,cursor,limit);},changes:(since:number)=>{assert();return operations.changes(since);}};},
  });
 }
 private view(row:TaskRow){const step=this.engine.get(row.task_id)!;const failure:ExecutionFailureReceipt|undefined=this.engine.failure(step.id);return {...step,input:undefined,ownership:undefined,progress:JSON.parse(row.progress),checkpoints:Object.keys(JSON.parse(row.checkpoints)),result:row.result===null?undefined:JSON.parse(row.result),externalState:row.external_state,externalUnresolved:Math.max(Number(this.db.prepare("SELECT count(*) n FROM task_external_calls WHERE task_id=? AND user_id=? AND state IN ('issued','unknown')").get(row.task_id,row.user_id)!.n),['issued','unknown'].includes(row.external_state)?1:0),...(failure?{failure}:{})};}
 tick(){return this.engine.tick();}
 start(){if(this.timer)return;this.timer=setInterval(()=>{void this.tick().catch(()=>{});},100);this.timer.unref();void this.tick().catch(()=>{});}
 async close(){if(this.timer)clearInterval(this.timer);this.timer=undefined;await this.engine.close();this.modelLeases.clear();}
 /** M16 observes only purpose-limited journal facts after deletion admission
  * has been fenced. No ordinary context can select or settle external calls. */
 pendingExternalForDeletion(subject:UserDataSubject){
  this.assertDeletionSubject(subject);return this.db.prepare("SELECT task_id taskId,issuance_id issuanceId,request_key key,state,attempt,issued_at issuedAt FROM task_external_calls WHERE user_id=? AND state IN ('issued','unknown') ORDER BY issued_at,issuance_id").all(subject.userId);
 }
 private assertDeletionSubject(subject:UserDataSubject){
  this.services.assertSubject(subject,EXECUTION_DOMAIN,'delete');if('credentialId' in subject)throw new ScopeError('invalid_identity',403);
  if(!this.db.prepare('SELECT 1 FROM task_lifecycle_state WHERE user_id=? AND deleted=1').get(subject.userId))throw new TaskError('task_deletion_not_started',409);
 }
 /** Settle one independently observed issuance. Confirmation to retry is never
  * evidence that the previous call did not execute. */
 settleExternalForDeletion(subject:UserDataSubject,taskId:string,outcome:'not-executed'|'completed',issuanceId?:string){
  this.assertDeletionSubject(subject);if(!['not-executed','completed'].includes(outcome))throw new TaskError('task_outcome_invalid');
  this.transaction(()=>{
   this.assertDeletionSubject(subject);const row=this.row(taskId);if(!row||row.user_id!==subject.userId)throw new TaskError('task_not_found',404);
   const pending=this.db.prepare("SELECT issuance_id FROM task_external_calls WHERE task_id=? AND user_id=? AND state IN ('issued','unknown')").all(taskId,subject.userId);
   if(!issuanceId&&pending.length>1)throw new TaskError('task_outcome_ambiguous',409);
   const target=issuanceId??(pending.length?String(pending[0].issuance_id):row.external_issuance??undefined);
   if(target){const call=this.db.prepare('SELECT state FROM task_external_calls WHERE issuance_id=? AND task_id=? AND user_id=?').get(target,taskId,subject.userId);if(!call)throw new TaskError('task_not_found',404);const state=outcome==='completed'?'succeeded':'not_executed';if(['succeeded','not_executed'].includes(String(call.state))&&call.state!==state)throw new TaskError('task_outcome_conflict',409);if(call.state!==state)this.db.prepare('UPDATE task_external_calls SET state=?,settled_at=? WHERE issuance_id=?').run(state,Date.now(),target);}
   // A portable history may carry an aggregate unknown without call details;
   // settling it remains a host lifecycle assertion, never a user retry.
   if(!target||target===row.external_issuance)this.db.prepare('UPDATE user_tasks SET external_state=? WHERE task_id=?').run(outcome==='completed'?'succeeded':'none',taskId);
  });
 }
 lifecycle():DomainLifecycle{return {
  exportUser:async subject=>{this.services.assertSubject(subject,EXECUTION_DOMAIN,'export');return this.transaction(()=>{this.services.assertSubject(subject,EXECUTION_DOMAIN,'export');const tasks=this.db.prepare('SELECT * FROM user_tasks WHERE user_id=? ORDER BY task_id').all(subject.userId) as TaskRow[];return {domain:EXECUTION_DOMAIN,version:1,deploymentId:subject.deploymentId,userId:subject.userId,payload:{format:'mote-user-tasks-v1',coverage:{metadata:true,credentials:false,activeAuthorization:false,portableInputs:'registered-handlers-only',excluded:['checkpoints','progress','results','failure-receipts','model-snapshots','external-journal-details']},tasks:tasks.map(row=>{const step=this.engine.get(row.task_id)!,handler=this.handlers.get(step.kind);return {id:step.id,operationId:step.operationId,kind:step.kind,pool:step.pool,state:step.state,attempts:step.attempts,authorizationEpoch:step.ownership!.authorizationEpoch,externalState:this.db.prepare("SELECT 1 FROM task_external_calls WHERE task_id=? AND user_id=? AND state IN ('issued','unknown') LIMIT 1").get(row.task_id,row.user_id)?'unknown':row.external_state,...(handler?.portableInput?{input:handler.portableInput(step.input)}:{inputOmitted:true}),dependencies:this.db.prepare('SELECT dependency_id FROM execution_dependencies WHERE step_id=?').all(step.id).map(row=>String(row.dependency_id))};})}};});},
  deleteUser:async(subject,operationId)=>{this.services.assertSubject(subject,EXECUTION_DOMAIN,'delete');const ids=this.transaction(()=>{this.services.assertSubject(subject,EXECUTION_DOMAIN,'delete');this.db.prepare('INSERT INTO task_lifecycle_state VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET deleted=1').run(subject.userId);const rows=this.db.prepare('SELECT task_id,external_state FROM user_tasks WHERE user_id=?').all(subject.userId);for(const row of rows){this.engine.cancel(String(row.task_id),false);this.grants.revoke(String(row.task_id));}return rows;});for(const row of ids){this.engine.abortLocal(String(row.task_id));this.modelLeases.delete(String(row.task_id));}const unknown=ids.some(row=>['issued','unknown'].includes(String(row.external_state)))||Boolean(this.db.prepare("SELECT 1 FROM task_external_calls WHERE user_id=? AND state IN ('issued','unknown') LIMIT 1").get(subject.userId));if(unknown)return {status:'result_unknown',operationId};this.transaction(()=>{this.services.assertSubject(subject,EXECUTION_DOMAIN,'delete');for(const row of ids)this.db.prepare('DELETE FROM execution_dependencies WHERE step_id=? OR dependency_id=?').run(row.task_id,row.task_id);for(const row of ids){this.db.prepare('DELETE FROM execution_steps WHERE id=?').run(row.task_id);this.db.prepare('DELETE FROM user_tasks WHERE task_id=?').run(row.task_id);this.db.prepare('DELETE FROM task_authorizations WHERE task_id=?').run(row.task_id);}const operations=this.db.prepare('SELECT id FROM operation_progress WHERE user_id=?').all(subject.userId);for(const operation of operations){this.db.prepare('DELETE FROM operation_generations WHERE operation_id=?').run(operation.id);this.db.prepare('DELETE FROM operation_parents WHERE parent_id=? OR child_id=?').run(operation.id,operation.id);this.db.prepare('DELETE FROM execution_fairness WHERE operation_id=?').run(operation.id);}this.db.prepare('DELETE FROM operation_progress WHERE user_id=?').run(subject.userId);for(const table of ['operation_changes','operation_user_sequences','execution_user_sequence','execution_user_fairness','task_restore_journal'])this.db.prepare('DELETE FROM '+table+' WHERE user_id=?').run(subject.userId);});return {status:'complete',operationId};},
  restoreUser:async(subject,archive,operationId)=>this.restore(subject,archive,operationId),
 };}
 private async restore(subject:UserDataSubject,archive:UserExport,operationId:string){
  this.services.assertSubject(subject,EXECUTION_DOMAIN,'restore');
  const task=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),operationId:z.string().regex(/^task:[a-f0-9]{64}$/),kind:id,pool:id,authorizationEpoch:z.number().int().safe().nonnegative(),state:z.enum(['waiting','running','blocked','succeeded','failed','cancelled','stale']),attempts:z.number().int().nonnegative(),externalState:z.enum(['none','issued','unknown','succeeded']),input:z.record(z.unknown()).optional(),inputOmitted:z.literal(true).optional(),dependencies:z.array(id)}).strict();
  const payload=z.object({format:z.literal('mote-user-tasks-v1'),coverage:z.object({metadata:z.literal(true),credentials:z.literal(false),activeAuthorization:z.literal(false),portableInputs:z.literal('registered-handlers-only'),excluded:z.tuple([z.literal('checkpoints'),z.literal('progress'),z.literal('results'),z.literal('failure-receipts'),z.literal('model-snapshots'),z.literal('external-journal-details')])}).strict(),tasks:z.array(task)}).strict().parse(archive.payload);
  if(archive.domain!==EXECUTION_DOMAIN||archive.version!==1||archive.userId!==subject.userId||archive.deploymentId!==subject.deploymentId)throw new TaskError('task_archive_invalid');
  // Restoring history never renews an account epoch, external-call authority or
  // configuration lease. Nonterminal work is visible but fenced for new host
  // authorization; whole-instance recovery keeps original durable grants.
  this.transaction(()=>{
   this.services.assertSubject(subject,EXECUTION_DOMAIN,'restore');const digest=hash(payload),prior=this.db.prepare('SELECT payload_hash FROM task_restore_journal WHERE user_id=? AND operation_id=?').get(subject.userId,operationId);
   if(prior){if(prior.payload_hash!==digest)throw new TaskError('task_restore_conflict',409);return;}
   const ids=new Set(payload.tasks.map(task=>task.id));if(ids.size!==payload.tasks.length)throw new TaskError('task_archive_invalid');
   const counts=new Map(payload.tasks.map(task=>[task.id,new Set(task.dependencies).size])),children=new Map<string,string[]>();
   for(const task of payload.tasks)for(const dependency of new Set(task.dependencies)){if(!ids.has(dependency))throw new TaskError('task_archive_invalid');const list=children.get(dependency)??[];list.push(task.id);children.set(dependency,list);}
   const ready=[...counts].filter(([,count])=>count===0).map(([taskId])=>taskId);for(let index=0;index<ready.length;index++)for(const child of children.get(ready[index])??[]){const remaining=counts.get(child)!-1;counts.set(child,remaining);if(!remaining)ready.push(child);}if(ready.length!==ids.size)throw new TaskError('task_archive_invalid');
   for(const task of payload.tasks){if(this.engine.get(task.id)||this.row(task.id)||task.dependencies.some(dependency=>!ids.has(dependency)))throw new TaskError('task_restore_conflict',409);if(Boolean(task.input)===Boolean(task.inputOmitted))throw new TaskError('task_archive_invalid');if(task.input&&this.handlers.has(task.kind))task.input=canonical(this.handlers.get(task.kind)!.parseInput(task.input)) as Record<string,unknown>;}
   const now=Date.now();
   for(const task of payload.tasks){
    const grantId=randomUUID(),encoded=json(task.input??{}),terminal=['succeeded','failed','cancelled','stale'].includes(task.state),state=terminal?task.state:'blocked';
    this.db.prepare('INSERT INTO task_authorizations VALUES(?,?,?,?,1)').run(grantId,task.id,subject.userId,task.authorizationEpoch);
    this.db.prepare('INSERT INTO user_tasks(task_id,user_id,grant_id,input,external_state,user_position) SELECT ?,?,?,?,?,coalesce(max(user_position),0)+1 FROM user_tasks WHERE user_id=?').run(task.id,subject.userId,grantId,encoded,task.externalState==='issued'?'unknown':task.externalState,subject.userId);
    const position=Number(this.db.prepare('INSERT INTO execution_user_sequence(user_id,next) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET next=next+1 RETURNING next').get(subject.userId)!.next);
    this.db.prepare('INSERT INTO execution_steps(id,operation_id,kind,pool,input,state,attempts,created_at,updated_at,user_id,user_position,authorization_epoch,grant_id,error) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(task.id,task.operationId,task.kind,task.pool,encoded,state,task.attempts,now,now,subject.userId,position,task.authorizationEpoch,grantId,terminal?null:'restore_authorization_required');
    linkOperation(this.storage,task.operationId,task.id);
   }
   for(const task of payload.tasks)for(const dependency of task.dependencies)this.db.prepare('INSERT INTO execution_dependencies VALUES(?,?)').run(task.id,dependency);
   this.db.prepare('INSERT INTO task_lifecycle_state VALUES(?,0) ON CONFLICT(user_id) DO UPDATE SET deleted=0').run(subject.userId);
   this.db.prepare('INSERT INTO task_restore_journal VALUES(?,?,?)').run(subject.userId,operationId,digest);
  });
 }
}
export type UserTaskService=ReturnType<TaskExecution['forUser']>;
