import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {Accounts} from './accounts.js';
import type {DurableIdentityVerifier,UserContext,VerifiedIdentity} from './context.js';
import {ScopeError} from './baseline.js';

/** Only the trusted task host issues and resolves these records. A grant ID is
 * an internal locator, never a login credential or a client-selectable owner. */
export class TaskAuthorization implements DurableIdentityVerifier {
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
 assert(grantId:string,userId?:string,epoch?:number){
  const row=this.db.prepare('SELECT * FROM task_authorizations WHERE grant_id=? AND revoked=0').get(grantId);
  if(!row||userId!==undefined&&row.user_id!==userId||epoch!==undefined&&row.authorization_epoch!==epoch)throw new ScopeError('invalid_identity',401);
  this.accounts.assertAccountEnabled(String(row.user_id),Number(row.authorization_epoch));return row;
 }
 async verify(grantId:string):Promise<VerifiedIdentity|undefined>{
  try{const row=this.assert(grantId),execution=this.db.prepare("SELECT fence FROM execution_steps WHERE id=? AND state='running' AND lease_until>?").get(row.task_id,Date.now());if(!execution?.fence)return undefined;return {deploymentId:this.deploymentId,userId:String(row.user_id),credentialId:grantId+':'+execution.fence,authorizationEpoch:Number(row.authorization_epoch),administrator:false};}catch{return undefined;}
 }
 isCurrent(identity:Readonly<VerifiedIdentity>){
  try{if(identity.deploymentId!==this.deploymentId||identity.administrator)return false;const [grantId,fence,...extra]=identity.credentialId.split(':');if(!grantId||!fence||extra.length)return false;const row=this.assert(grantId,identity.userId,identity.authorizationEpoch);if(!this.db.prepare("SELECT 1 FROM execution_steps WHERE id=? AND state='running' AND fence=? AND lease_until>?").get(row.task_id,fence,Date.now())||!this.executionValidator||this.validating.has(identity.credentialId))return false;this.validating.add(identity.credentialId);try{return this.executionValidator(String(row.task_id),fence);}finally{this.validating.delete(identity.credentialId);}}catch{return false;}
 }
 revoke(taskId:string){this.db.prepare('UPDATE task_authorizations SET revoked=1 WHERE task_id=?').run(taskId);}
}
