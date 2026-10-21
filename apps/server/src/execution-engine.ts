import type {StatementSync} from 'node:sqlite';
import {ProviderFailure} from '@mote/shared';
import {installOperationProjection,linkOperation,type OperationMembership} from './operation-projection.js';
import {randomUUID,createHash} from 'node:crypto';
import {setImmediate as yieldTurn,setTimeout as delay} from 'node:timers/promises';
import {StoreError,type ExecutionStorage} from './execution-storage.js';
import {withExecutionCancellation} from './execution-cancellation.js';
import {failureContext,retainFailureContext,safeFailureContext,type FailureContext} from './execution-failures.js';
import {EXECUTION_POLICIES,type ExecutionPolicy} from './execution-policy.js';
import {ExecutionAttempts} from './execution-attempts.js';

export type ExecutionState='waiting'|'running'|'blocked'|'succeeded'|'failed'|'cancelled'|'stale';
export type ExecutionLane='background'|'interactive';
/** Trusted host configuration. Lane is derived from existing product identity,
 * never from model-authored input or a new persistent authority field. */
export type ExecutionPoolAdmission={concurrency:Record<ExecutionLane,()=>number>;lane:(step:ExecutionStep)=>ExecutionLane;
 /** Optional host physical-lifetime gate. false leaves work queued without admission or fairness/state changes. */
 available?:(step:ExecutionStep)=>boolean;
 /** Host-defined capacity shared across pools. A coordinator and its exact
  * physical child may share one unit; input cannot install this callback. */
 partition?:(step:ExecutionStep)=>{key:string;unit:string;concurrency:number}|undefined;
};
/** Issued and checked by the host task adapter; never accepted from task input.
 * A session credential is deliberately absent: logout does not revoke work. */
export type ExecutionOwnership=Readonly<{userId:string;authorizationEpoch:number;grantId?:string}>;
export type ExecutionStep={id:string;operationId:string;kind:string;pool:string;input:Record<string,unknown>;state:ExecutionState;attempts:number;availableAt:number;attemptId?:string;maxAttempts?:number;maxRetries?:number;retriesUsed?:number;attemptsRemaining?:number;retryRound?:number;retryExhausted?:boolean;error?:string;ownership?:ExecutionOwnership};
export type ExecutionEnqueueOptions=OperationMembership&{ownership?:ExecutionOwnership;id?:string;dependencies?:string[];initial?:{state:ExecutionState;attempts:number;availableAt:number;error?:string}};
export type ExecutionFailureReceipt=FailureContext&{stepId:string;operationId:string;kind:string;state:ExecutionState;category:ExecutionFailure['category'];code:string;attempt:number;at:string;executionStarted?:false;admissionWaiting?:true;availableAt?:number};
/** A running handler can publish incremental progress only through its current lease. */
export interface ExecutionGrant {
 assert():void;
 commit<T>(write:()=>T):T;
 /** Start operation protection only after a physical admission gate opens. */
 startBudget():void;
 /** Protect one physical call; capacity/resource waits stay outside its budget. */
 withBudget<T>(work:()=>Promise<T>):Promise<T>;
 /** Trusted actual query fragments retain execution across a later unexecuted capacity wait. */
 recordExecution():void;hasExecuted():boolean;
 /** Release an admitted physical resource after its call stages have settled. */
 releaseResource(key:string):void;
 /** Acquire a resource only for a continuous handler's physical effect.
  * It shares the durable engine locks without admitting another task. */
 withResource<T>(key:string,work:()=>Promise<T>):Promise<T>;
}
export class ExecutionFailure extends Error {
 constructor(readonly category:'transient'|'permanent'|'blocked'|'stale'|'waiting',readonly code:string,readonly retryAfterMs?:number,readonly facts?:{executionStarted:false}){super(code);}
}
export interface ExecutionHandler {
 kind:string;pool:string;concurrency:()=>number;
 policy?:ExecutionPolicy;
 validate:(step:ExecutionStep)=>boolean;
 /** Extra authority check for a running parent's dependent publication. */
 validateGrant?:(step:ExecutionStep)=>boolean;
 resourceKeys?:(step:ExecutionStep)=>string[];
 fairnessGroup?:(step:ExecutionStep)=>string;
 deferTimeout?:boolean;
 /** A continuous task spends an attempt on its first physical call/effect. */
 deferAttempts?:boolean;
 admit?:(step:ExecutionStep)=>ExecutionFailure|undefined;
 execute:(step:ExecutionStep,signal:AbortSignal,grant:ExecutionGrant)=>Promise<unknown>;
 /** Host-only, synchronous commit runs in the engine's fenced transaction. */
 commit:(step:ExecutionStep,result:unknown)=>void;
 /** Compatibility views are projections, never used to claim a running step. */
 project?:(step:ExecutionStep)=>void;
 classify?:(error:unknown)=>ExecutionFailure;
 timeoutMs?:number|null|((step:ExecutionStep)=>number|null);
 maxAttempts?:number;
 maxRecoveryWindowMs?:number|null;
 /** Trusted identities/stage only; the engine never persists arbitrary errors. */
 failureContext?:(step:ExecutionStep)=>FailureContext;
}
type ProgramStep<T>=OperationMembership&{ownership?:ExecutionOwnership;id:string;operationId:string;kind:string;pool:string;input:Record<string,unknown>;signal:AbortSignal;validate:()=>boolean;resourceKeys?:string[];admit?:()=>ExecutionFailure|undefined;execute:(signal:AbortSignal)=>Promise<unknown>;commit:(result:unknown)=>void;read:()=>T|undefined;project:(step:ExecutionStep)=>void;cached?:boolean;initialAttempts?:number;policy?:ExecutionPolicy;timeoutMs?:number|null;maxAttempts?:number;maxRecoveryWindowMs?:number|null;classify?:(error:unknown)=>ExecutionFailure};
type Row={id:string;operation_id:string;kind:string;pool:string;input:string;state:ExecutionState;attempts:number;available_at:number;error:string|null;fence:string|null;lease_until:number;recovery_deadline?:number;user_id:string;user_position:number;authorization_epoch:number|null;grant_id:string|null};
const view=(row:Row):ExecutionStep=>({id:row.id,operationId:row.operation_id,kind:row.kind,pool:row.pool,input:JSON.parse(row.input),state:row.state,attempts:row.attempts,availableAt:row.available_at,...(row.error?{error:row.error}:{}),...(row.user_id?{ownership:Object.freeze({userId:row.user_id,authorizationEpoch:row.authorization_epoch!,...(row.grant_id?{grantId:row.grant_id}:{})})}:{})});
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,canonical(v)])):value;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const interrupted=new Error('Execution interrupted');

/** The host owns admission, retry, cancellation, leases and commit fences. */
export class ExecutionEngine {
 private readonly attempts:ExecutionAttempts;
 // Only fixed synchronous host queries use these private compiled statements.
 // Rows, bindings and authority decisions are read again on every call.
 private readonly validationStatements=new Map<string,StatementSync>();
 private validationStatement(sql:string){
  const prior=this.validationStatements.get(sql);
  if(prior){try{void prior.sourceSQL;return prior;}catch(error){
   if((error as NodeJS.ErrnoException).code!=='ERR_INVALID_STATE'||!this.store.db.isOpen)throw error;
   this.validationStatements.delete(sql);
  }}
  const statement=this.store.db.prepare(sql);this.validationStatements.set(sql,statement);return statement;
 }

 private programs=new Map<string,Promise<unknown>>();
 private handlers=new Map<string,ExecutionHandler>();
 private admissions=new Map<string,ExecutionPoolAdmission>();
 private active=new Map<string,{controller:AbortController;task:Promise<void>;pool:string;kind:string;lane:ExecutionLane;step:ExecutionStep}>();
 private stopping=false;
 private pumping=false;
 private pumpAgain=false;
 private scheduled=false;
 private failureReceiptWriteFailures=0;
 constructor(readonly store:ExecutionStorage,private now=Date.now){
  // The epoch-5 host admits a vault before constructing the engine. Do not
  // silently upgrade an older execution format or backfill private ownership.
  for(const [table,required] of [['execution_steps',['user_id','user_position','authorization_epoch','grant_id']],['operation_progress',['user_id','user_position']],['operation_changes',['user_id','user_seq']]] as const){
   const columns=store.db.prepare(`PRAGMA table_info(${table})`).all().map(row=>String(row.name));
   if(columns.length&&required.some(column=>!columns.includes(column)))throw new StoreError('Unsupported execution schema',409);
  }
  store.db.exec(`CREATE TABLE IF NOT EXISTS execution_steps(id TEXT PRIMARY KEY,operation_id TEXT NOT NULL,kind TEXT NOT NULL,pool TEXT NOT NULL,input TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,available_at INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,fence TEXT,error TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,recovery_deadline INTEGER NOT NULL DEFAULT 0,user_id TEXT NOT NULL DEFAULT '',user_position INTEGER NOT NULL DEFAULT 0,authorization_epoch INTEGER,grant_id TEXT);
   CREATE TABLE IF NOT EXISTS execution_resources(step_id TEXT NOT NULL REFERENCES execution_steps(id) ON DELETE CASCADE,resource_key TEXT NOT NULL,PRIMARY KEY(step_id,resource_key));
   CREATE TABLE IF NOT EXISTS execution_dynamic_resources(step_id TEXT NOT NULL REFERENCES execution_steps(id) ON DELETE CASCADE,resource_key TEXT NOT NULL,fence TEXT NOT NULL,PRIMARY KEY(step_id,resource_key));
   CREATE TABLE IF NOT EXISTS execution_resource_waits(step_id TEXT NOT NULL REFERENCES execution_steps(id) ON DELETE CASCADE,resource_key TEXT NOT NULL,fence TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(step_id,resource_key));
   CREATE TABLE IF NOT EXISTS execution_attempt_charges(step_id TEXT PRIMARY KEY REFERENCES execution_steps(id) ON DELETE CASCADE,fence TEXT NOT NULL,charged INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS execution_resource_owners ON execution_resources(resource_key,step_id);
   CREATE TABLE IF NOT EXISTS execution_dependencies(step_id TEXT NOT NULL REFERENCES execution_steps(id) ON DELETE CASCADE,dependency_id TEXT NOT NULL REFERENCES execution_steps(id),PRIMARY KEY(step_id,dependency_id));
   CREATE INDEX IF NOT EXISTS execution_dependents ON execution_dependencies(dependency_id,step_id);
   CREATE TABLE IF NOT EXISTS execution_cancellation_aliases(alias_id TEXT PRIMARY KEY,step_id TEXT NOT NULL REFERENCES execution_steps(id) ON DELETE CASCADE,cancelled INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS execution_operation_steps(operation_id TEXT NOT NULL,step_id TEXT NOT NULL REFERENCES execution_steps(id) ON DELETE CASCADE,slot TEXT NOT NULL DEFAULT '',generation TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,optional INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(operation_id,step_id));
   CREATE INDEX IF NOT EXISTS execution_membership_step ON execution_operation_steps(step_id,active,operation_id);
   CREATE INDEX IF NOT EXISTS execution_ready ON execution_steps(pool,state,available_at,created_at);
   CREATE INDEX IF NOT EXISTS execution_operations ON execution_steps(operation_id,created_at);
   CREATE TABLE IF NOT EXISTS execution_sequence(pool TEXT PRIMARY KEY,next INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS execution_fairness(pool TEXT NOT NULL,operation_id TEXT NOT NULL,last_started INTEGER NOT NULL,PRIMARY KEY(pool,operation_id));
   CREATE TABLE IF NOT EXISTS execution_user_fairness(pool TEXT NOT NULL,user_id TEXT NOT NULL,last_started INTEGER NOT NULL,PRIMARY KEY(pool,user_id));
   CREATE TABLE IF NOT EXISTS execution_user_sequence(user_id TEXT PRIMARY KEY,next INTEGER NOT NULL);`);
  store.db.exec('CREATE TABLE IF NOT EXISTS execution_stage_groups(step_id TEXT PRIMARY KEY REFERENCES execution_steps(id) ON DELETE CASCADE,group_key TEXT NOT NULL); CREATE TABLE IF NOT EXISTS execution_stage_fairness(pool TEXT NOT NULL,user_id TEXT NOT NULL,group_key TEXT NOT NULL,last_started INTEGER NOT NULL,PRIMARY KEY(pool,user_id,group_key))');
  store.db.exec('CREATE TABLE IF NOT EXISTS execution_resource_releases(step_id TEXT NOT NULL REFERENCES execution_steps(id) ON DELETE CASCADE,resource_key TEXT NOT NULL,fence TEXT NOT NULL,PRIMARY KEY(step_id,resource_key))');
  store.db.exec('CREATE INDEX IF NOT EXISTS execution_user_steps ON execution_steps(user_id,state,created_at); CREATE INDEX IF NOT EXISTS execution_user_position ON execution_steps(user_id,user_position)');
  store.db.exec('CREATE TABLE IF NOT EXISTS execution_failures(step_id TEXT PRIMARY KEY REFERENCES execution_steps(id) ON DELETE CASCADE,json TEXT NOT NULL)');
  store.db.exec('CREATE INDEX IF NOT EXISTS execution_recovery_deadline ON execution_steps(state,recovery_deadline)');
  this.attempts=new ExecutionAttempts(store.db);
  installOperationProjection(store);
 }
 get closed(){return this.stopping;}
 private policy(handler:ExecutionHandler,step:ExecutionStep){const base=handler.policy??EXECUTION_POLICIES.orchestration;return {timeoutMs:handler.timeoutMs===undefined?base.timeoutMs:typeof handler.timeoutMs==='function'?handler.timeoutMs(step):handler.timeoutMs,maxAttempts:handler.maxAttempts??base.maxAttempts,maxRecoveryWindowMs:handler.maxRecoveryWindowMs===undefined?base.maxRecoveryWindowMs:handler.maxRecoveryWindowMs};}
 configurePool(pool:string,admission:ExecutionPoolAdmission){this.admissions.set(pool,admission);}
 private lane(step:ExecutionStep):ExecutionLane{return this.admissions.get(step.pool)?.lane(step)==='interactive'?'interactive':'background';}
 private limit(pool:string,lane:ExecutionLane){
  const admission=this.admissions.get(pool),configured=admission?admission.concurrency[lane]():Math.min(...[...this.handlers.values()].filter(handler=>handler.pool===pool).map(handler=>handler.concurrency()));
  return Math.max(1,Math.min(lane==='background'?32:Number.MAX_SAFE_INTEGER,Math.floor(configured)));
 }
 private running(pool:string,lane:ExecutionLane,now=this.now()){
  return (this.store.db.prepare("SELECT * FROM execution_steps WHERE pool=? AND state='running' AND lease_until>?").all(pool,now) as Row[]).filter(row=>this.lane(view(row))===lane).length;
 }
 private capacity(step:ExecutionStep){
  const lane=this.lane(step),partition=this.admissions.get(step.pool)?.partition?.(step);
  if(!partition)return {key:JSON.stringify(['pool',step.pool,lane]),unit:step.id,limit:this.limit(step.pool,lane),partitioned:false};
  if(!partition.key||partition.key.length>256||!partition.unit||partition.unit.length>256||!Number.isSafeInteger(partition.concurrency)||partition.concurrency<1)throw Error('Invalid host execution capacity');
  return {key:JSON.stringify(['partition',partition.key]),unit:partition.unit,limit:partition.concurrency,partitioned:true};
 }
 private capacityAvailable(step:ExecutionStep,now=this.now()){
  if(this.active.has(step.id))return false;
  if(this.admissions.get(step.pool)?.available?.(step)===false)return false;
  const capacity=this.capacity(step),units=new Set<string>();
  const pools=capacity.partitioned?[...this.admissions].filter(([,admission])=>admission.partition).map(([pool])=>pool):[step.pool];
  const count=(current:ExecutionStep)=>{const value=this.capacity(current);if(value.key===capacity.key)units.add(value.unit);};
  // Durable leases arbitrate other connections; this host also counts local
  // execution promises that have not yet finished settling.
  for(const row of this.store.db.prepare("SELECT * FROM execution_steps WHERE state='running' AND lease_until>? AND pool IN(SELECT value FROM json_each(?))").all(now,JSON.stringify(pools)))count(view(row as Row));
  for(const active of this.active.values())if(pools.includes(active.pool))count(active.step);
  return units.has(capacity.unit)||units.size<capacity.limit;
 }
 /** Safe resource projection: no goals, evidence, provider credentials or prose. */
 poolSnapshot(pool:string){
  const lanes=this.admissions.has(pool)?['background','interactive'] as const:['background'] as const;
  const waiting=this.store.db.prepare("SELECT * FROM execution_steps WHERE pool=? AND state='waiting'").all(pool) as Row[];
  const running=this.store.db.prepare("SELECT * FROM execution_steps WHERE pool=? AND state='running' AND lease_until>?").all(pool,this.now()) as Row[];
  return Object.fromEntries(lanes.map(lane=>{const limits=new Map<string,number>();limits.set(JSON.stringify(['pool',pool,lane]),this.limit(pool,lane));for(const row of [...waiting,...running])if(this.lane(view(row))===lane){const value=this.capacity(view(row));limits.set(value.key,value.limit);}return [lane,{limit:Math.min(Number.MAX_SAFE_INTEGER,[...limits.values()].reduce((sum,value)=>sum+value,0)),running:this.running(pool,lane),waiting:waiting.filter(row=>this.lane(view(row))===lane).length}];}));
 }
 register(handler:ExecutionHandler){if(this.handlers.has(handler.kind))throw Error('Duplicate execution handler');this.handlers.set(handler.kind,handler);return async()=>{if(this.handlers.get(handler.kind)!==handler)return;this.handlers.delete(handler.kind);const running=[...this.active.values()].filter(value=>value.kind===handler.kind);for(const value of running)value.controller.abort(interrupted);await Promise.allSettled(running.map(value=>value.task));};}
 enqueue(operationId:string,kind:string,input:Record<string,unknown>,options:ExecutionEnqueueOptions={}){
  if(this.stopping)throw new StoreError('Execution engine is closed',503);
  const handler=this.handlers.get(kind);if(!handler)throw new StoreError('Execution handler unavailable',409);
  input=canonical(input) as Record<string,unknown>;
  const json=JSON.stringify(input);
  const ownership=options.ownership;
  if(ownership&&(!ownership.userId||!Number.isSafeInteger(ownership.authorizationEpoch)||ownership.authorizationEpoch<0||ownership.grantId!==undefined&&!ownership.grantId))throw new StoreError('Invalid execution ownership',400);
  const id=options.id??hash([ownership?.userId??'',operationId,kind,input]),now=this.now(),db=this.store.db;
  const own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');
  try{
   const existing=db.prepare('SELECT 1 FROM execution_steps WHERE id=?').get(id);
   if(!existing){this.store.reserveMetadata(Buffer.byteLength(json)+1024);const position=Number(db.prepare('INSERT INTO execution_user_sequence(user_id,next) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET next=next+1 RETURNING next').get(ownership?.userId??'')!.next);db.prepare("INSERT INTO execution_steps(id,operation_id,kind,pool,input,state,created_at,updated_at,user_id,user_position,authorization_epoch,grant_id) VALUES(?,?,?,?,?,'waiting',?,?,?,?,?,?)").run(id,operationId,kind,handler.pool,json,now,now,ownership?.userId??'',position,ownership?.authorizationEpoch??null,ownership?.grantId??null);}
   const step=this.get(id)!;if(step.kind!==kind||JSON.stringify(step.input)!==json||step.ownership?.userId!==ownership?.userId||step.ownership?.authorizationEpoch!==ownership?.authorizationEpoch||step.ownership?.grantId!==ownership?.grantId)throw new StoreError('Execution identity conflict',409);
   this.attempts.policy(id,this.retryDefaults(step.kind)!.maxAttempts);
   const group=handler.fairnessGroup?.(step);if(group!==undefined){if(!/^[a-zA-Z0-9_.:-]{1,128}$/.test(group))throw new StoreError('Invalid execution fairness group',400);db.prepare('INSERT INTO execution_stage_groups VALUES(?,?) ON CONFLICT(step_id) DO UPDATE SET group_key=excluded.group_key').run(id,group);}
   if(options.initial&&!existing){const seed=options.initial;db.prepare('UPDATE execution_steps SET state=?,attempts=?,available_at=?,error=? WHERE id=?').run(seed.state==='running'?'waiting':seed.state,seed.attempts,seed.availableAt,seed.state==='running'?'interrupted':seed.error??null,id);}
   for(const key of new Set(handler.resourceKeys?.(step)??[]))if(!db.prepare('SELECT 1 FROM execution_resources WHERE step_id=? AND resource_key=?').get(id,key)){this.store.reserveMetadata(Buffer.byteLength(key)+64);db.prepare('INSERT INTO execution_resources VALUES(?,?)').run(id,key);}
   for(const dep of options.dependencies??[]){const parent=this.get(dep);if(!parent||parent.ownership?.userId!==step.ownership?.userId)throw new StoreError('Execution dependency unavailable',409);if(dep===id||db.prepare('WITH RECURSIVE ancestors(id) AS (SELECT dependency_id FROM execution_dependencies WHERE step_id=? UNION SELECT d.dependency_id FROM execution_dependencies d JOIN ancestors a ON a.id=d.step_id) SELECT 1 FROM ancestors WHERE id=?').get(dep,id))throw new StoreError('Execution dependency cycle',409);db.prepare('INSERT OR IGNORE INTO execution_dependencies VALUES(?,?)').run(id,dep);}
   linkOperation(this.store,operationId,id,options);handler.project?.(this.get(id)!);if(own)db.exec('COMMIT');return id;
  }catch(error){if(own)db.exec('ROLLBACK');throw error;}
 }
 /** Host timing only; no task or lease authority is granted by reading it. */
 clockNow(){return this.now();}
 retryDefaults(kind:string){const handler=this.handlers.get(kind);if(!handler)return;const maxAttempts=handler.maxAttempts??(handler.policy??EXECUTION_POLICIES.orchestration).maxAttempts;return {maxAttempts,maxRetries:maxAttempts-1};}
 get(id:string){const row=this.validationStatement('SELECT * FROM execution_steps WHERE id=?').get(id) as Row|undefined;return row?{...view(row),...this.retryDefaults(row.kind),...this.attempts.describe(id,row.attempts,row.state)}:undefined;}
 failure(id:string):ExecutionFailureReceipt|undefined {const row=this.store.db.prepare('SELECT json FROM execution_failures WHERE step_id=?').get(id);return row?JSON.parse(String(row.json)):undefined;}
 failureDiagnostics(){return {writeFailures:this.failureReceiptWriteFailures};}
 private retainFailure(step:ExecutionStep,state:ExecutionState,failure:ExecutionFailure,error?:unknown,at=this.now()){
  // One bounded receipt per retained step follows that step's existing deletion
  // lifecycle. A full disk must not turn failure reporting into another run.
  let hostContext:FailureContext={};try{hostContext=this.handlers.get(step.kind)?.failureContext?.(step)??{};}catch{/* Retired inputs cannot remove the fixed execution receipt. */}
  try{const context={...hostContext,...failureContext(error)},receipt:ExecutionFailureReceipt={...safeFailureContext(context),stepId:step.id,operationId:step.operationId,kind:step.kind,state,category:failure.category,code:/^[a-z][a-z0-9_.:-]{0,99}$/.test(failure.code)?failure.code:'execution_failed',attempt:step.attempts,at:new Date(at).toISOString(),...((error instanceof ProviderFailure&&error.details.executionStarted===false||error instanceof ExecutionFailure&&error.facts?.executionStarted===false)?{executionStarted:false as const}:{}),...(error instanceof ProviderFailure&&error.details.admissionWaiting===true?{admissionWaiting:true as const}:{}),...(state==='waiting'&&step.availableAt>0?{availableAt:step.availableAt}:{})},json=JSON.stringify(receipt),prior=this.store.db.prepare('SELECT length(json) bytes FROM execution_failures WHERE step_id=?').get(step.id);this.store.reserveMetadata(Math.max(0,Buffer.byteLength(json)-Number(prior?.bytes??0))+(!prior?Buffer.byteLength(step.id)+128:0));this.store.db.prepare('INSERT INTO execution_failures VALUES(?,?) ON CONFLICT(step_id) DO UPDATE SET json=excluded.json').run(step.id,json);}catch{this.failureReceiptWriteFailures++;}
 }
 list(args:{userId?:string;operationId?:string;kind?:string;state?:ExecutionState;cursor?:number;limit?:number}={}){
  const clauses:string[]=[],values:(string|number)[]=[];
  if(args.userId!==undefined){clauses.push('user_id=?');values.push(args.userId);}
  if(args.operationId){clauses.push('EXISTS(SELECT 1 FROM execution_operation_steps o WHERE o.step_id=execution_steps.id AND o.operation_id=?)');values.push(args.operationId);}
  for(const [key,column] of [['kind','kind'],['state','state']] as const)if(args[key]){clauses.push(column+'=?');values.push(args[key]!);}
  const position=args.userId===undefined?'rowid':'user_position';
  if(args.cursor!==undefined){clauses.push(position+'<?');values.push(args.cursor);}
  const limit=Math.max(1,Math.min(args.limit??50,100)),rows=this.store.db.prepare(`SELECT rowid,* FROM execution_steps ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY ${position} DESC LIMIT ?`).all(...values,limit+1) as (Row&{rowid:number})[];
  return {items:rows.slice(0,limit).map(view),nextCursor:rows.length>limit?rows[limit-1][position]:null};
 }
 project(id:string){const step=this.get(id);if(step)this.handlers.get(step.kind)?.project?.(step);}
 /** Transactional callers may defer local abort; lease renewal observes committed revocation. */
 cancel(id:string,abortLocal=true,reason='cancelled'){
  if(!/^[a-z][a-z0-9_]{0,80}$/.test(reason))throw new StoreError('Invalid cancellation reason',400);
  const alias=this.store.db.prepare('SELECT step_id FROM execution_cancellation_aliases WHERE alias_id=?').get(id);
  if(alias){this.store.db.prepare('UPDATE execution_cancellation_aliases SET cancelled=1 WHERE alias_id=?').run(id);id=String(alias.step_id);}
  const db=this.store.db;db.prepare("UPDATE execution_steps SET state='cancelled',fence=NULL,error=?,updated_at=? WHERE id=? AND state!='succeeded'").run(reason,this.now(),id);if(abortLocal)this.active.get(id)?.controller.abort();this.project(id);
 }
 /** Stable operation identities can revoke the currently active resumable
  * fragment from another host without depending on its revision number. */
 bindCancellationAlias(aliasId:string,stepId:string){
  if(this.cancellationAliasRevoked(aliasId))throw new ExecutionFailure('stale','cancelled');
  this.store.db.prepare('INSERT INTO execution_cancellation_aliases(alias_id,step_id) VALUES(?,?) ON CONFLICT(alias_id) DO UPDATE SET step_id=excluded.step_id').run(aliasId,stepId);
 }
 cancellationAliasRevoked(aliasId:string){return Boolean(this.store.db.prepare('SELECT 1 FROM execution_cancellation_aliases WHERE alias_id=? AND cancelled=1').get(aliasId));}
 /** Revoke an unfinished run after a host deadline without pretending the user cancelled. */
 fail(id:string,code:string,context?:FailureContext){
  if(!/^[a-z][a-z0-9_]{0,80}$/.test(code))throw new StoreError('Invalid execution failure code',400);
  const db=this.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');
  try{if(db.prepare("UPDATE execution_steps SET state='failed',fence=NULL,error=?,updated_at=? WHERE id=? AND state NOT IN ('succeeded','failed','cancelled','stale')").run(code,this.now(),id).changes){const step=this.get(id)!;this.retainFailure(step,'failed',new ExecutionFailure('permanent',code),context?retainFailureContext(new Error(),context):undefined);}this.project(id);if(own)db.exec('COMMIT');}
  catch(error){if(own)db.exec('ROLLBACK');throw error;}
  this.active.get(id)?.controller.abort();
 }
 cancelKind(kind:string){for(;;){const rows=this.store.db.prepare("SELECT id FROM execution_steps WHERE kind=? AND state NOT IN ('succeeded','cancelled','stale') LIMIT 500").all(kind);if(!rows.length)return;for(const row of rows)this.cancel(String(row.id));}}
 retry(id:string,resetAttempts=false){
  if(this.get(id)?.state==='running')throw new StoreError('Cancel the active step before retrying',409);
  const db=this.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');
  try{const step=this.get(id),handler=step&&this.handlers.get(step.kind);if(step&&handler)this.attempts.policy(id,this.retryDefaults(step.kind)!.maxAttempts);this.active.get(id)?.controller.abort();if(resetAttempts)this.attempts.reset(id,this.now());db.prepare("UPDATE execution_steps SET state='waiting',attempts=CASE WHEN ? THEN 0 ELSE attempts END,available_at=0,lease_until=0,fence=NULL,error=NULL,recovery_deadline=CASE WHEN ? THEN 0 ELSE recovery_deadline END,updated_at=? WHERE id=? AND state!='running'").run(Number(resetAttempts),Number(resetAttempts),this.now(),id);this.project(id);if(own)db.exec('COMMIT');}catch(error){if(own&&db.isTransaction)db.exec('ROLLBACK');throw error;}
 }
 /** Stop only this host's work after another writer revoked its durable grant. */
 abortLocal(id:string){this.active.get(id)?.controller.abort();}
 isCurrentGrant(id:string,fence:string){return Boolean(this.validationStatement("SELECT 1 FROM execution_steps WHERE id=? AND fence=? AND state='running' AND lease_until>?").get(id,fence,this.now()));}
 /** A child publication must retain both its parent's lease and input authority. */
 isCurrentInputGrant(id:string,fence:string){const step=this.get(id),handler=step&&this.handlers.get(step.kind);return Boolean(!this.stopping&&!this.active.get(id)?.controller.signal.aborted&&step&&handler&&this.isCurrentGrant(id,fence)&&handler.validate(step)&&(handler.validateGrant?.(step)??true));}
 /** A queued child retains durable input authority while its parent yields a
  * worker slot. Cancellation, paused admission and changed inputs still revoke
  * it. A temporary execution lease is not the authorization for derived work. */
 isCurrentInputAuthority(id:string){const step=this.get(id),handler=step&&this.handlers.get(step.kind);return Boolean(step&&handler&&['running','waiting'].includes(step.state)&&handler.validate(step)&&(handler.validateGrant?.(step)??true));}
 hasActive(kind:string){return [...this.active.keys()].some(id=>this.get(id)?.kind===kind);}
 /** Cancellation revokes the durable grant before local transport cleanup ends. */
 isActiveStep(id:string){return this.active.has(id);}
 /** Several completions in one turn need only one admission pass. */
 /** Host capacity release notification; use the original coalesced admission path. */
 wake(){this.scheduleTick();}
 private scheduleTick(){
  if(this.stopping||this.scheduled)return;
  this.scheduled=true;queueMicrotask(()=>{this.scheduled=false;void this.tick().catch(()=>{});});
 }
 async drain(ids:string[]){
  void this.tick().catch(()=>{});
  for(;;){const tasks=ids.flatMap(id=>{const task=this.active.get(id)?.task;return task?[task]:[];});if(!tasks.length)return;await Promise.all(tasks);void this.tick().catch(()=>{});}
 }
 /** Running continuations and ready static publishers share one durable
  * user/operation turn order. The same order across keys avoids lock-order cycles. */
 private resourceTurn(stepId:string,key:string){
  const db=this.store.db,now=this.now();
  if(!db.prepare("SELECT 1 FROM execution_resource_waits w JOIN execution_steps e ON e.id=w.step_id AND e.fence=w.fence WHERE w.resource_key=? AND e.state='running' AND e.lease_until>?").get(key,now))return true;
  const ordered=db.prepare(`WITH candidates AS (
   SELECT e.id,e.user_id,e.operation_id,w.created_at,e.rowid AS position FROM execution_resource_waits w JOIN execution_steps e ON e.id=w.step_id AND e.fence=w.fence WHERE w.resource_key=? AND e.state='running' AND e.lease_until>?
   UNION ALL
   SELECT e.id,e.user_id,e.operation_id,e.created_at,e.rowid FROM execution_resources r JOIN execution_steps e ON e.id=r.step_id WHERE r.resource_key=? AND e.state='waiting' AND e.available_at<=? AND e.kind IN(SELECT value FROM json_each(?))
    AND NOT EXISTS(SELECT 1 FROM execution_dependencies d JOIN execution_steps parent ON parent.id=d.dependency_id WHERE d.step_id=e.id AND parent.state!='succeeded')
    AND NOT EXISTS(SELECT 1 FROM execution_resources requested JOIN (SELECT step_id,resource_key FROM execution_resources UNION ALL SELECT d.step_id,d.resource_key FROM execution_dynamic_resources d JOIN execution_steps e ON e.id=d.step_id AND e.fence=d.fence) held ON held.resource_key=requested.resource_key JOIN execution_steps owner ON owner.id=held.step_id WHERE requested.step_id=e.id AND owner.id!=e.id AND owner.state='running' AND owner.lease_until>? AND NOT EXISTS(SELECT 1 FROM execution_resource_releases released WHERE released.step_id=owner.id AND released.resource_key=held.resource_key AND released.fence=owner.fence))
  ) SELECT c.id FROM candidates c LEFT JOIN execution_user_fairness u ON u.pool='@resources' AND u.user_id=c.user_id LEFT JOIN execution_fairness f ON f.pool='@resources' AND f.operation_id=c.operation_id ORDER BY coalesce(u.last_started,0),coalesce(f.last_started,0),c.created_at,c.position`).all(key,now,key,now,JSON.stringify([...this.handlers.keys()]),now);
  for(const candidate of ordered){const step=this.get(String(candidate.id));if(!step||step.state==='waiting'&&!this.capacityAvailable(step,now))continue;return step.id===stepId;}
  return true;
 }
 private servedResource(step:ExecutionStep){
  const db=this.store.db,sequence=Number(db.prepare("INSERT INTO execution_sequence VALUES('@resources',1) ON CONFLICT(pool) DO UPDATE SET next=next+1 RETURNING next").get()!.next);
  db.prepare("INSERT INTO execution_user_fairness VALUES('@resources',?,?) ON CONFLICT(pool,user_id) DO UPDATE SET last_started=excluded.last_started").run(step.ownership?.userId??'',sequence);
  db.prepare("INSERT INTO execution_fairness VALUES('@resources',?,?) ON CONFLICT(pool,operation_id) DO UPDATE SET last_started=excluded.last_started").run(step.operationId,sequence);
 }
 private staticResourceTurn(step:ExecutionStep){return this.store.db.prepare('SELECT resource_key FROM execution_resources WHERE step_id=?').all(step.id).every(row=>this.resourceTurn(step.id,String(row.resource_key)));}
 private recover(){
  const db=this.store.db,now=this.now();
  for(const row of db.prepare("SELECT * FROM execution_steps WHERE state='waiting' AND recovery_deadline>0 AND recovery_deadline<=?").all(now) as Row[]){
   const handler=this.handlers.get(row.kind);
   // A retired dynamic definition cannot invent a recovery policy. Current
   // tasks with no elapsed recovery budget also retire old generic deadlines.
   if(!handler)continue;
   if(this.policy(handler,view(row)).maxRecoveryWindowMs===null){db.prepare('UPDATE execution_steps SET recovery_deadline=0 WHERE id=?').run(row.id);continue;}
   if(handler&&!handler.validate(view(row))){db.prepare("UPDATE execution_steps SET state='stale',fence=NULL,error='input_changed',updated_at=? WHERE id=? AND state='waiting'").run(now,row.id);this.project(row.id);}
   else this.fail(row.id,'recovery_window_exhausted');
  }
  for(const row of db.prepare("SELECT e.*,s.id attempt_session,s.charged attempt_charged FROM execution_steps e LEFT JOIN execution_attempt_sessions s ON s.step_id=e.id AND s.open=1 WHERE e.state='running' AND e.lease_until<=?").all(now) as (Row&{attempt_session:string|null;attempt_charged:number|null})[]){
   // A stale scan cannot retire a renewed lease or a replacement attempt. The
   // exact expired fence CAS and its own charged session close are one write.
   const own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');let recovered=false;
   try{recovered=Boolean(db.prepare("UPDATE execution_steps SET state='waiting',fence=NULL,error='interrupted',available_at=0,updated_at=? WHERE id=? AND state='running' AND fence IS ? AND lease_until<=?").run(now,row.id,row.fence,now).changes);
    if(recovered&&row.attempt_session&&row.attempt_charged)this.store.db.prepare('UPDATE execution_attempt_sessions SET open=0 WHERE id=? AND step_id=? AND open=1').run(row.attempt_session,row.id);
    if(own)db.exec('COMMIT');
   }catch(error){if(own&&db.isTransaction)db.exec('ROLLBACK');throw error;}
   if(recovered)this.project(row.id);
  }
 }
 /** Start available slots. Return only work admitted by this call; slow older work is independent. */
 tick(){
  if(this.stopping)return Promise.resolve();
  if(this.pumping){this.pumpAgain=true;return Promise.resolve();}
  this.pumping=true;const started:Promise<void>[]=[],unclaimed=new Set<string>();
  try{
   this.recover();
   this.store.db.prepare("DELETE FROM execution_resource_waits WHERE NOT EXISTS(SELECT 1 FROM execution_steps e WHERE e.id=execution_resource_waits.step_id AND e.fence=execution_resource_waits.fence AND e.state='running' AND e.lease_until>?)").run(this.now());
   this.store.db.prepare("DELETE FROM execution_dynamic_resources WHERE NOT EXISTS(SELECT 1 FROM execution_steps e WHERE e.id=execution_dynamic_resources.step_id AND e.fence=execution_dynamic_resources.fence AND e.state='running' AND e.lease_until>?)").run(this.now());
   const blocked=this.validationStatement("WITH RECURSIVE blocked(id) AS (SELECT id FROM execution_steps WHERE state IN ('failed','blocked','cancelled','stale') UNION SELECT d.step_id FROM execution_dependencies d JOIN blocked b ON b.id=d.dependency_id) SELECT e.id FROM execution_steps e JOIN blocked b ON b.id=e.id WHERE e.state='waiting'").all();
   for(const row of blocked){this.store.db.prepare("UPDATE execution_steps SET state='blocked',error='dependency_failed',updated_at=? WHERE id=? AND state='waiting'").run(this.now(),String(row.id));this.project(String(row.id));}
   const pools=[...new Set([...this.handlers.values()].map(h=>h.pool))];
   for(const pool of pools){
    const handlers=[...this.handlers.values()].filter(h=>h.pool===pool),lanes:ExecutionLane[]=this.admissions.has(pool)?['background','interactive']:['background'];
    for(const lane of lanes){
    for(;;){
     const candidateSql=`SELECT e.* FROM execution_steps e LEFT JOIN execution_user_fairness u ON u.pool=e.pool AND u.user_id=e.user_id LEFT JOIN execution_stage_groups g ON g.step_id=e.id LEFT JOIN execution_stage_fairness s ON s.pool=e.pool AND s.user_id=e.user_id AND s.group_key=g.group_key LEFT JOIN execution_fairness f ON f.pool=e.pool AND f.operation_id=e.operation_id WHERE e.pool=? AND e.state='waiting' AND e.available_at<=? AND e.kind IN (SELECT value FROM json_each(?)) AND NOT EXISTS(SELECT 1 FROM execution_dependencies d JOIN execution_steps parent ON parent.id=d.dependency_id WHERE d.step_id=e.id AND parent.state!='succeeded') AND NOT EXISTS(SELECT 1 FROM execution_resources requested JOIN (SELECT step_id,resource_key FROM execution_resources UNION ALL SELECT d.step_id,d.resource_key FROM execution_dynamic_resources d JOIN execution_steps e ON e.id=d.step_id AND e.fence=d.fence) held ON held.resource_key=requested.resource_key JOIN execution_steps owner ON owner.id=held.step_id WHERE requested.step_id=e.id AND owner.id!=e.id AND owner.state='running' AND owner.lease_until>? AND NOT EXISTS(SELECT 1 FROM execution_resource_releases released WHERE released.step_id=owner.id AND released.resource_key=held.resource_key AND released.fence=owner.fence)) ORDER BY coalesce(u.last_started,0),coalesce(s.last_started,0),coalesce(f.last_started,0),e.created_at,e.rowid`;let row:Row|undefined;
     // A failed native iterator must not carry its old error into a later tick.
     try{
      const candidates=this.validationStatement(candidateSql).iterate(pool,this.now(),JSON.stringify(handlers.map(h=>h.kind)),this.now());
      for(const candidate of candidates){if(!unclaimed.has(String(candidate.id))&&!this.active.has(String(candidate.id))&&this.lane(view(candidate as Row))===lane&&this.capacityAvailable(view(candidate as Row))&&this.staticResourceTurn(view(candidate as Row))){row=candidate as Row;break;}}
     }catch(error){this.validationStatements.delete(candidateSql);throw error;}
     if(!row)break;
     const handler=this.handlers.get(row.kind)!;if(!handler.validate(view(row))){this.store.db.prepare("UPDATE execution_steps SET state='stale',error='input_changed',updated_at=? WHERE id=? AND state='waiting'").run(this.now(),row.id);this.project(row.id);continue;}
     let admission:ReturnType<ExecutionEngine['claim']>;
     try{admission=this.claim(row,handler);}
     catch(error){unclaimed.add(row.id);started.push(Promise.reject(error));continue;}
     // A rejected transactional recheck owns no local slot. Skip it only for
     // this pass so an unchanged waiting head cannot spin or hide eligible work.
     if(!admission||!('launch' in admission)){unclaimed.add(row.id);if(admission)started.push(admission.pause);continue;}
     const controller=new AbortController();let completed=true;const task=Promise.resolve().then(()=>admission.launch(controller)).catch(error=>{completed=false;throw error;}).finally(()=>{this.active.delete(row.id);if(completed)this.scheduleTick();});
     // Claim first, reserve locally second, then launch on the next microtask.
     // Handler IO never escapes before cancellation/capacity can find its owner.
     this.active.set(row.id,{controller,task,pool,kind:row.kind,lane,step:view(row)});started.push(task);
    }
    }
   }
  }finally{this.pumping=false;if(this.pumpAgain){this.pumpAgain=false;this.scheduleTick();}}
  return Promise.all(started).then(()=>{});
 }
 private claim(row:Row,handler:ExecutionHandler):{launch:(controller:AbortController)=>Promise<void>}|{pause:Promise<void>}|undefined{
  const db=this.store.db,now=this.now(),fence=randomUUID(),policy=this.policy(handler,view(row)),timeout=policy.timeoutMs;
  db.exec('BEGIN IMMEDIATE');
  try{
   if(db.prepare("SELECT state FROM execution_steps WHERE id=?").get(row.id)?.state!=='waiting'){db.exec('COMMIT');return;}
   if(!this.capacityAvailable(view(row),now)){db.exec('COMMIT');return;}
   if(db.prepare("SELECT 1 FROM execution_resources requested JOIN (SELECT step_id,resource_key FROM execution_resources UNION ALL SELECT d.step_id,d.resource_key FROM execution_dynamic_resources d JOIN execution_steps e ON e.id=d.step_id AND e.fence=d.fence) held ON held.resource_key=requested.resource_key JOIN execution_steps owner ON owner.id=held.step_id WHERE requested.step_id=? AND owner.id!=? AND owner.state='running' AND owner.lease_until>? AND NOT EXISTS(SELECT 1 FROM execution_resource_releases released WHERE released.step_id=owner.id AND released.resource_key=held.resource_key AND released.fence=owner.fence) LIMIT 1").get(row.id,row.id,now)){db.exec('COMMIT');return;}
   if(!this.staticResourceTurn(view(row))){db.exec('COMMIT');return;}
   if(!handler.validate(view(row))){db.prepare("UPDATE execution_steps SET state='stale',error='input_changed',updated_at=? WHERE id=? AND state='waiting'").run(now,row.id);this.project(row.id);db.exec('COMMIT');return;}
   this.attempts.policy(row.id,policy.maxAttempts);
   const session=this.attempts.open(row.id);
   if(this.get(row.id)!.attempts>=policy.maxAttempts&&!session.charged){db.prepare("UPDATE execution_steps SET state='failed',error='retry_budget_exhausted',updated_at=? WHERE id=? AND state='waiting'").run(now,row.id);this.attempts.close(row.id);this.retainFailure(this.get(row.id)!,'failed',new ExecutionFailure('permanent','retry_budget_exhausted'));this.project(row.id);db.exec('COMMIT');return;}
   const admission=handler.admit?.(this.get(row.id)!);
   if(admission){
    db.prepare("UPDATE execution_steps SET state=?,available_at=?,error=?,recovery_deadline=CASE WHEN ? THEN 0 ELSE recovery_deadline END,updated_at=? WHERE id=? AND state='waiting'").run(admission.category==='waiting'?'waiting':'blocked',admission.category==='waiting'?this.now()+Math.max(1,admission.retryAfterMs??1000):0,admission.code,Number(admission.category==='waiting'),now,row.id);this.project(row.id);db.exec('COMMIT');
    // A short retry can become due again while the backlog is being checked.
    // Yield after the durable decision, with no transaction or running lease,
    // so both background completion wakes and explicit drains allow timers.
    return admission.category==='waiting'?{pause:yieldTurn()}:undefined;
   }
   if(!handler.deferAttempts)this.attempts.charge(row.id,session.id,policy.maxAttempts);
   const claimed=db.prepare("UPDATE execution_steps SET state='running',fence=?,lease_until=?,error=NULL,updated_at=? WHERE id=? AND state='waiting'").run(fence,now+(timeout===null?30000:Math.min(timeout+10000,30000)),now,row.id).changes;
   if(!claimed){db.exec('COMMIT');return;}
   db.prepare('INSERT INTO execution_attempt_charges VALUES(?,?,?) ON CONFLICT(step_id) DO UPDATE SET fence=excluded.fence,charged=excluded.charged').run(row.id,fence,this.attempts.current(row.id)!.charged);
   if(db.prepare('SELECT 1 FROM execution_resources WHERE step_id=?').get(row.id))this.servedResource(this.get(row.id)!);
   const sequence=Number(db.prepare('INSERT INTO execution_sequence(pool,next) VALUES(?,1) ON CONFLICT(pool) DO UPDATE SET next=next+1 RETURNING next').get(row.pool)!.next);
   db.prepare('INSERT INTO execution_user_fairness(pool,user_id,last_started) VALUES(?,?,?) ON CONFLICT(pool,user_id) DO UPDATE SET last_started=excluded.last_started').run(row.pool,row.user_id,sequence);
   const group=db.prepare('SELECT group_key FROM execution_stage_groups WHERE step_id=?').get(row.id);if(group)db.prepare('INSERT INTO execution_stage_fairness VALUES(?,?,?,?) ON CONFLICT(pool,user_id,group_key) DO UPDATE SET last_started=excluded.last_started').run(row.pool,row.user_id,String(group.group_key),sequence);
   db.prepare('INSERT INTO execution_fairness(pool,operation_id,last_started) VALUES(?,?,?) ON CONFLICT(pool,operation_id) DO UPDATE SET last_started=excluded.last_started').run(row.pool,row.operation_id,sequence);
   this.project(row.id);db.exec('COMMIT');
  }catch(error){if(db.isTransaction)db.exec('ROLLBACK');db.prepare("UPDATE execution_steps SET state='blocked',error=?,updated_at=? WHERE id=? AND state='waiting'").run(error instanceof StoreError&&error.statusCode===507?'storage_full':'admission_failed',this.now(),row.id);this.project(row.id);return;}
  return {launch:controller=>this.execute(row,handler,controller,fence,policy)};
 }
 private async execute(row:Row,handler:ExecutionHandler,controller:AbortController,fence:string,policy:ExecutionPolicy){
  const db=this.store.db,timeout=policy.timeoutMs;
  // Dispose deadlines when work settles. Composed AbortSignal.timeout sources
  // can remain strongly retained by Node until a long deadline actually fires.
  const step=this.get(row.id)!,signal=controller.signal;
  const attemptId=step.attemptId!;
  let deadline:ReturnType<typeof setTimeout>|undefined,budgetStarted=false;
  const startBudget=()=>{if(budgetStarted)return;budgetStarted=true;if(timeout!==null){deadline=setTimeout(()=>controller.abort(new DOMException('The operation was aborted due to timeout','TimeoutError')),timeout);deadline.unref();}};
  if(!handler.deferTimeout)startBudget();
  const renewal=setInterval(()=>{if(this.stopping)return;try{const at=this.now();if(!db.prepare("UPDATE execution_steps SET lease_until=? WHERE id=? AND state='running' AND fence=? AND lease_until>?").run(at+30000,row.id,fence,at).changes)controller.abort();}catch{controller.abort();}},10000);renewal.unref();
  try{
   const assertGrant=()=>{
    if(signal.aborted)throw new ExecutionFailure('stale','grant_revoked');
    if(!this.isCurrentGrant(row.id,fence))throw new ExecutionFailure('stale','grant_revoked');
    if(!handler.validate(step)||!(handler.validateGrant?.(step)??true))throw new ExecutionFailure('stale','input_changed');
   };
   const grant:ExecutionGrant=Object.freeze({assert:assertGrant,recordExecution:()=>{assertGrant();this.attempts.recordExecution(attemptId);},hasExecuted:()=>this.attempts.executed(attemptId),withBudget:async<T>(work:()=>Promise<T>):Promise<T>=>{
    assertGrant();grant.commit(()=>{const charged=this.attempts.charge(row.id,attemptId,policy.maxAttempts);if(charged===undefined)throw new ExecutionFailure('permanent','retry_budget_exhausted');if(charged)step.attempts++;this.attempts.enter(attemptId);db.prepare('UPDATE execution_attempt_charges SET charged=1 WHERE step_id=? AND fence=?').run(row.id,fence);});let callDeadline:ReturnType<typeof setTimeout>|undefined;
    if(timeout!==null){callDeadline=setTimeout(()=>controller.abort(new DOMException('The operation was aborted due to timeout','TimeoutError')),timeout);callDeadline.unref();}
    let executed=true;try{const value=await work();assertGrant();return value;}catch(error){if(error instanceof ProviderFailure&&error.details.executionStarted===false||error instanceof ExecutionFailure&&error.facts?.executionStarted===false)executed=false;throw error;}finally{clearTimeout(callDeadline);this.attempts.finish(attemptId,executed);}
   },withResource:async<T>(key:string,work:()=>Promise<T>):Promise<T>=>{
    if(!key||key.length>1024)throw new ExecutionFailure('permanent','resource_invalid');
    // A dynamic reservation is a running-grant fact. It never becomes a
    // prerequisite on recovery, so retained model checkpoints can resume before
    // requesting the publisher again. Old fences convey no lock ownership.
    let acquired=false,reacquiredStatic=false;
    const owned=grant.commit(()=>Boolean(db.prepare("SELECT 1 FROM execution_resources WHERE step_id=? AND resource_key=? AND NOT EXISTS(SELECT 1 FROM execution_resource_releases WHERE step_id=? AND resource_key=? AND fence=?) UNION ALL SELECT 1 FROM execution_dynamic_resources WHERE step_id=? AND resource_key=? AND fence=?").get(row.id,key,row.id,key,fence,row.id,key,fence)));
    if(owned){const value=await work();assertGrant();return value;}
    grant.commit(()=>{this.store.reserveMetadata(Buffer.byteLength(key)+96);db.prepare('INSERT INTO execution_resource_waits VALUES(?,?,?,?) ON CONFLICT(step_id,resource_key) DO UPDATE SET fence=excluded.fence,created_at=excluded.created_at').run(row.id,key,fence,this.now());});this.scheduleTick();
    try{
     for(;;){
      const claim=grant.commit(()=>{
       if(!this.resourceTurn(row.id,key))return false;
       if(db.prepare("SELECT 1 FROM (SELECT step_id,resource_key FROM execution_resources UNION ALL SELECT d.step_id,d.resource_key FROM execution_dynamic_resources d JOIN execution_steps e ON e.id=d.step_id AND e.fence=d.fence) held JOIN execution_steps owner ON owner.id=held.step_id WHERE held.resource_key=? AND owner.id!=? AND owner.state='running' AND owner.lease_until>? AND NOT EXISTS(SELECT 1 FROM execution_resource_releases released WHERE released.step_id=owner.id AND released.resource_key=held.resource_key AND released.fence=owner.fence) LIMIT 1").get(key,row.id,this.now()))return false;
       if(db.prepare('SELECT 1 FROM execution_resources WHERE step_id=? AND resource_key=?').get(row.id,key)){db.prepare('DELETE FROM execution_resource_releases WHERE step_id=? AND resource_key=? AND fence=?').run(row.id,key,fence);reacquiredStatic=true;}
       else if(!db.prepare('SELECT 1 FROM execution_resources WHERE step_id=? AND resource_key=?').get(row.id,key)&&!db.prepare('SELECT 1 FROM execution_dynamic_resources WHERE step_id=? AND resource_key=? AND fence=?').get(row.id,key,fence)){
        this.store.reserveMetadata(Buffer.byteLength(key)+96);
        db.prepare('INSERT INTO execution_dynamic_resources VALUES(?,?,?) ON CONFLICT(step_id,resource_key) DO UPDATE SET fence=excluded.fence').run(row.id,key,fence);acquired=true;
       }
       this.servedResource(step);db.prepare('DELETE FROM execution_resource_waits WHERE step_id=? AND resource_key=? AND fence=?').run(row.id,key,fence);return true;
      });
      if(claim)break;
      await delay(20,undefined,{signal});assertGrant();
     }
     assertGrant();const value=await work();assertGrant();return value;
    }finally{
     db.prepare('DELETE FROM execution_resource_waits WHERE step_id=? AND resource_key=? AND fence=?').run(row.id,key,fence);
     if(acquired)db.prepare('DELETE FROM execution_dynamic_resources WHERE step_id=? AND resource_key=? AND fence=?').run(row.id,key,fence);
     if(reacquiredStatic&&this.isCurrentGrant(row.id,fence))db.prepare('INSERT INTO execution_resource_releases VALUES(?,?,?) ON CONFLICT(step_id,resource_key) DO UPDATE SET fence=excluded.fence').run(row.id,key,fence);
     this.scheduleTick();
    }
   },startBudget:()=>{assertGrant();startBudget();},releaseResource:(key:string)=>{grant.commit(()=>{if(!db.prepare('SELECT 1 FROM execution_resources WHERE step_id=? AND resource_key=?').get(row.id,key))return;db.prepare('INSERT INTO execution_resource_releases VALUES(?,?,?) ON CONFLICT(step_id,resource_key) DO UPDATE SET fence=excluded.fence').run(row.id,key,fence);});this.scheduleTick();},commit:<T>(write:()=>T):T=>{
    if(db.isTransaction)throw new Error('Execution grant commit requires its own transaction');
    db.exec('BEGIN IMMEDIATE');
    try{assertGrant();const result=write();assertGrant();db.exec('COMMIT');return result;}
    catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
   }});
   const result=await withExecutionCancellation(signal,()=>handler.execute(step,signal,grant));
   signal.throwIfAborted();
   db.exec('BEGIN IMMEDIATE');
   try{
    if(!this.isCurrentGrant(row.id,fence)){db.exec('ROLLBACK');return;}
    if(!handler.validate(step)||!(handler.validateGrant?.(step)??true))throw new ExecutionFailure('stale','input_changed');
    handler.commit(step,result);
    // A synchronous commit may itself revoke account/resource authority. Do not
    // publish its writes when the same transaction invalidated the grant.
    if(!(handler.validateGrant?.(step)??true))throw new ExecutionFailure('stale','input_changed');
    const at=this.now();
    if(!db.prepare("UPDATE execution_steps SET state='succeeded',fence=NULL,error=NULL,updated_at=? WHERE id=? AND fence=? AND state='running' AND lease_until>?").run(at,row.id,fence,at).changes){db.exec('ROLLBACK');return;}
    this.attempts.close(row.id);this.project(row.id);db.exec('COMMIT');
   }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
  }catch(error){
   const classified=error instanceof ExecutionFailure?error:error instanceof ProviderFailure?new ExecutionFailure(error.details.category,error.details.code,error.details.retryAfterMs):handler.classify?.(error)??new ExecutionFailure('permanent','processor_failed');
   // A fixed transport/admission fact is a capacity wait, never evidence that
   // the input failed processing. Domain issued-call guards still decide if a
   // physical request may be sent; this does not clear an unknown outcome.
   const admissionWait=error instanceof ProviderFailure&&error.details.admissionWaiting===true;
   const failure=admissionWait||classified.code==='rate_limited'&&classified.category==='transient'?new ExecutionFailure('waiting',classified.code,classified.retryAfterMs):classified;
   const stopping=this.stopping||signal.reason===interrupted;
   const capacityWait=failure.category==='waiting';
   const at=this.now();
   const recoveryDeadline=capacityWait||policy.maxRecoveryWindowMs===null?0:failure.category==='transient'&&!stopping?(Number(row.recovery_deadline)||at+Math.max(1,policy.maxRecoveryWindowMs)):Number(row.recovery_deadline)||0;
   let code=stopping?'interrupted':failure.code;
   const own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');let changed=false;
   try{if(this.isCurrentGrant(row.id,fence)){
    if(capacityWait)this.attempts.refundWaiting(row.id,attemptId);
    const attempts=this.get(row.id)!.attempts;
    let state:ExecutionState=stopping?'waiting':failure.category==='blocked'?'blocked':failure.category==='stale'?'stale':capacityWait?'waiting':failure.category==='permanent'||attempts>=policy.maxAttempts?'failed':'waiting';
    const availableAt=stopping?0:at+Math.max(capacityWait?1:0,failure.retryAfterMs??(capacityWait?1000:Math.min(3600000,1000*2**(attempts-1))));
    if(!stopping&&state==='waiting'&&failure.category==='transient'&&recoveryDeadline&&availableAt>=recoveryDeadline){state='failed';code='recovery_window_exhausted';}
    if(!capacityWait&&(!stopping||this.attempts.current(row.id)?.charged))this.attempts.close(row.id);
    changed=Boolean(db.prepare("UPDATE execution_steps SET state=?,error=?,available_at=?,recovery_deadline=?,fence=NULL,updated_at=? WHERE id=? AND fence=? AND state='running' AND lease_until>?").run(state,code,availableAt,recoveryDeadline,at,row.id,fence,at).changes);if(changed)this.retainFailure(this.get(row.id)!,state,new ExecutionFailure(failure.category,code),error,at);
   }if(own)db.exec('COMMIT');}catch(error){if(own&&db.isTransaction)db.exec('ROLLBACK');throw error;}
   if(changed)handler.project?.(this.get(row.id)!);
  }finally{clearTimeout(deadline);clearInterval(renewal);}
  await yieldTurn();
 }
 /** Replayable host programs define a substep when reached. State and its artifact
  * commit still belong to this engine; a restart reconstructs the definition. */
 async runStep<T>(options:ProgramStep<T>):Promise<T>{
  const prior=this.programs.get(options.id);
  const task=(async()=>{if(prior)await withExecutionCancellation(options.signal,()=>prior.catch(()=>{}));return this.replayStep(options);})();
  this.programs.set(options.id,task);
  try{return await task;}finally{if(this.programs.get(options.id)===task)this.programs.delete(options.id);}
 }
 private async replayStep<T>(options:ProgramStep<T>):Promise<T>{
  options.signal.throwIfAborted();
  const kind=options.kind+'.'+options.id;let failure:unknown;
  const unregister=this.register({kind,pool:options.pool,concurrency:()=>1,validate:()=>options.validate(),resourceKeys:()=>options.resourceKeys??[],admit:options.admit,policy:options.policy,timeoutMs:options.timeoutMs,maxAttempts:options.maxAttempts,maxRecoveryWindowMs:options.maxRecoveryWindowMs,
   execute:async(_step,signal)=>{try{return await options.execute(AbortSignal.any([signal,options.signal]));}catch(error){failure=error;throw error;}},
   commit:(_step,result)=>{try{options.commit(result);}catch(error){failure=error;throw error;}},project:options.project,
   // The child owns retries; a replayed parent only observes durable progress.
   classify:options.classify??(()=>new ExecutionFailure('permanent','step_failed')),
  });
  const abort=()=>{if(this.stopping||options.signal.reason===interrupted)this.active.get(options.id)?.controller.abort(interrupted);else this.cancel(options.id);};options.signal.addEventListener('abort',abort,{once:true});
  try{
   this.enqueue(options.operationId,kind,options.input,{id:options.id,ownership:options.ownership,generation:options.generation,optional:options.optional,initial:{state:options.cached?'succeeded':'waiting',attempts:options.initialAttempts??0,availableAt:0}});
   const current=this.get(options.id)!;
   // Reaching a blocked prerequisite again rechecks the current handler's
   // admission (including an issued-call guard). It never reopens cancelled,
   // stale or failed work, whose explicit retry belongs to the domain owner.
   if(current.state==='blocked'||current.state==='succeeded'&&options.read()===undefined)this.retry(options.id,false);
   await this.drain([options.id]);options.signal.throwIfAborted();
   const step=this.get(options.id)!,value=step.state==='succeeded'?options.read():undefined;
   if(value!==undefined)return value;
   // The child owns its real retry budget. A replayable parent yields its slot
   // and budget while that child waits, including across host restarts.
   if(step.state==='waiting')throw retainFailureContext(new ExecutionFailure('waiting',step.error??'step_pending',Math.max(1,step.availableAt-this.now())),{causeStepId:step.id,causeCode:step.error??'step_pending',causeState:step.state});
   if(step.state==='stale')throw new ExecutionFailure('stale','input_changed');
   if(step.state==='cancelled')throw new ExecutionFailure('permanent','cancelled');
   if(step.state==='blocked')throw new ExecutionFailure('blocked',step.error??'step_blocked');
   if(step.state==='failed')throw retainFailureContext(new ExecutionFailure('permanent',step.error??'step_failed'),{...failureContext(failure),causeStepId:step.id,causeCode:step.error??'step_failed',causeState:step.state});
   if(failure)throw failure;
   throw new ExecutionFailure('waiting','step_pending',Math.max(1000,step.availableAt-this.now()));
  }finally{options.signal.removeEventListener('abort',abort);await unregister();}
 }
 async close(){this.stopping=true;for(const active of this.active.values())active.controller.abort(interrupted);await Promise.allSettled([...this.active.values()].map(a=>a.task));await Promise.allSettled([...this.programs.values()]);}
}
