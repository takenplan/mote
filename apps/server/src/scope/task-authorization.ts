import {randomUUID} from 'node:crypto';
import type {DatabaseSync,StatementSync} from 'node:sqlite';
import type {Accounts} from './accounts.js';
import type {DurableIdentityVerifier,UserContext,VerifiedIdentity} from './context.js';
import {ScopeError} from './baseline.js';
import type {ExecutionStep} from '../execution-engine.js';

/** Only the trusted task host issues and resolves these records. A grant ID is
 * an internal locator, never a login credential or a client-selectable owner. */
export class TaskAuthorization implements DurableIdentityVerifier {
 // Only fixed synchronous host queries use these private compiled statements.
 // Rows, bindings and authority decisions are read again on every call.
 private readonly validationStatements=new Map<string,StatementSync>();
 private validationStatement(sql:string){
  const prior=this.validationStatements.get(sql);
  if(prior){try{void prior.sourceSQL;return prior;}catch(error){
   if((error as NodeJS.ErrnoException).code!=='ERR_INVALID_STATE'||!this.db.isOpen)throw error;
   this.validationStatements.delete(sql);
  }}
  const statement=this.db.prepare(sql);this.validationStatements.set(sql,statement);return statement;
 }

 private executionValidator:((taskId:string,fence:string)=>boolean)|undefined;
 private readonly validating=new Set<string>();
 bindExecution(validator:(taskId:string,fence:string)=>boolean){if(this.executionValidator)throw new ScopeError('undeclared_scope',500);this.executionValidator=validator;}
 constructor(private readonly db:DatabaseSync,private readonly accounts:Accounts,readonly deploymentId:string){
  db.exec(`CREATE TABLE IF NOT EXISTS task_authorizations(grant_id TEXT PRIMARY KEY,task_id TEXT NOT NULL UNIQUE,user_id TEXT NOT NULL,authorization_epoch INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
   CREATE INDEX IF NOT EXISTS task_authorizations_user ON task_authorizations(user_id);`);
 }
 issue(context:UserContext,taskId:string){
  this.accounts.assertAccountEnabled(context.userId,context.authorizationEpoch);
  const grantId=randomUUID();this.db.prepare('INSERT INTO task_authorizations VALUES(?,?,?,?,0)').run(grantId,taskId,context.userId,context.authorizationEpoch);return grantId;
 }
 /** Fixed host-only M06 handoff. The old intent supplies account authority,
  * never a running context. Only the new task's real lease can restore one. */
 issueProcessingRecheck(intentId:string,taskId:string){
  const source=this.db.prepare("SELECT a.grant_id FROM task_authorizations a JOIN execution_steps e ON e.id=a.task_id WHERE a.task_id=? AND e.user_id=a.user_id AND e.kind IN('processing.pipeline','processing.derivatives') AND e.state IN('blocked','failed','stale')").get(intentId);
  if(!source)throw new ScopeError('invalid_identity',401);const row=this.assert(String(source.grant_id)),grantId=randomUUID();
  this.db.prepare('INSERT INTO task_authorizations VALUES(?,?,?,?,0)').run(grantId,taskId,row.user_id,row.authorization_epoch);
  return {grantId,userId:String(row.user_id),authorizationEpoch:Number(row.authorization_epoch)};
 }
 /** Fixed configuration handoff. Account authority comes only from an existing
  * admitted processing intent, never from a configuration factory subject. */
 issueProcessingConfiguration(intentId:string,taskId:string){
  const source=this.db.prepare(`SELECT a.grant_id FROM task_authorizations a JOIN execution_steps e ON e.id=a.task_id AND e.user_id=a.user_id
   WHERE a.task_id=? AND e.state IN('waiting','running','blocked','failed','stale') AND
   (e.kind='processing.pipeline' OR e.kind='processing.configuration' AND EXISTS(SELECT 1 FROM task_processing_config_handoffs h WHERE h.task_id=e.id AND h.user_id=e.user_id))`).get(intentId);
  if(!source)throw new ScopeError('invalid_identity',401);const row=this.assert(String(source.grant_id)),grantId=randomUUID();
  this.db.prepare('INSERT INTO task_authorizations VALUES(?,?,?,?,0)').run(grantId,taskId,row.user_id,row.authorization_epoch);
  return {grantId,userId:String(row.user_id),authorizationEpoch:Number(row.authorization_epoch)};
 }
 assert(grantId:string,userId?:string,epoch?:number){
  const row=this.validationStatement('SELECT * FROM task_authorizations WHERE grant_id=? AND revoked=0').get(grantId);
  if(!row||userId!==undefined&&row.user_id!==userId||epoch!==undefined&&row.authorization_epoch!==epoch)throw new ScopeError('invalid_identity',401);
  this.accounts.assertAccountEnabled(String(row.user_id),Number(row.authorization_epoch));return row;
 }
 /** Fixed TaskExecution.valid checkpoint. Read fresh facts together, then keep
  * the account's independent read and closed-state check. No proof escapes. */
 assertExecutionTaskIdentity(step:Pick<ExecutionStep,'id'|'ownership'>):void{
  const row=this.validationStatement(`SELECT t.user_id AS validation_task_user_id,t.grant_id AS validation_task_grant_id,
   CASE WHEN l.user_id IS NULL THEN 0 ELSE 1 END AS validation_deleted,
   CASE WHEN g.grant_id IS NULL THEN 0 ELSE 1 END AS validation_grant_present,g.*
   FROM user_tasks AS t
   LEFT JOIN task_lifecycle_state AS l ON l.user_id=t.user_id AND l.deleted=1
   LEFT JOIN task_authorizations AS g ON g.grant_id=t.grant_id AND g.revoked=0
   WHERE t.task_id=?`).get(step.id);
  if(!row||!step.ownership||row.validation_task_user_id!==step.ownership.userId||row.validation_task_grant_id!==step.ownership.grantId)throw new ScopeError('invalid_identity',401);
  if(row.validation_deleted)throw new ScopeError('invalid_identity',401);
  const userId=row.validation_task_user_id,epoch=step.ownership.authorizationEpoch;
  if(!row.validation_grant_present||userId!==undefined&&row.user_id!==userId||epoch!==undefined&&row.authorization_epoch!==epoch)throw new ScopeError('invalid_identity',401);
  this.accounts.assertAccountEnabled(String(row.user_id),Number(row.authorization_epoch));
  if(row.task_id!==step.id)throw new ScopeError('invalid_identity',401);
 }
 async verify(grantId:string):Promise<VerifiedIdentity|undefined>{
  try{const row=this.assert(grantId),execution=this.validationStatement("SELECT fence FROM execution_steps WHERE id=? AND state='running' AND lease_until>?").get(row.task_id,Date.now());if(!execution?.fence)return undefined;return {deploymentId:this.deploymentId,userId:String(row.user_id),credentialId:grantId+':'+execution.fence,authorizationEpoch:Number(row.authorization_epoch),administrator:false};}catch{return undefined;}
 }
 isCurrent(identity:Readonly<VerifiedIdentity>){
  try{if(identity.deploymentId!==this.deploymentId||identity.administrator)return false;const [grantId,fence,...extra]=identity.credentialId.split(':');if(!grantId||!fence||extra.length)return false;const row=this.assert(grantId,identity.userId,identity.authorizationEpoch);if(!this.validationStatement("SELECT 1 FROM execution_steps WHERE id=? AND state='running' AND fence=? AND lease_until>?").get(row.task_id,fence,Date.now())||!this.executionValidator||this.validating.has(identity.credentialId))return false;this.validating.add(identity.credentialId);try{return this.executionValidator(String(row.task_id),fence);}finally{this.validating.delete(identity.credentialId);}}catch{return false;}
 }
 revoke(taskId:string){this.db.prepare('UPDATE task_authorizations SET revoked=1 WHERE task_id=?').run(taskId);}
}
