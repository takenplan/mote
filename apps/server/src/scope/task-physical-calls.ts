import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {ExecutionFailure,type ExecutionStep} from '../execution-engine.js';

export type ModelRecoveryMode='read-query'|'reconcile';
/** Physical lifetime facts outlive short business grants. Only the callback
 * closure that acquired an owner token can attest its completed cleanup. */
export class TaskPhysicalCalls {
 private readonly incarnation=randomUUID();
 private readonly current=new AsyncLocalStorage<{id:string;token:string;taskId:string}>();
 constructor(private db:DatabaseSync){db.exec(`
  CREATE TABLE IF NOT EXISTS task_physical_calls(id TEXT PRIMARY KEY,task_id TEXT NOT NULL,user_id TEXT NOT NULL,deployment_id TEXT NOT NULL,incarnation TEXT NOT NULL,attempt_id TEXT NOT NULL,owner_token TEXT NOT NULL,snapshot_id TEXT NOT NULL,mode TEXT NOT NULL,state TEXT NOT NULL,issuance_id TEXT UNIQUE,created_at INTEGER NOT NULL,quiescent_at INTEGER);
  CREATE INDEX IF NOT EXISTS task_physical_active ON task_physical_calls(task_id,state);
  CREATE INDEX IF NOT EXISTS task_physical_live ON task_physical_calls(state,task_id);
  CREATE INDEX IF NOT EXISTS task_physical_owner ON task_physical_calls(user_id,state);
  CREATE TABLE IF NOT EXISTS task_physical_resources(call_id TEXT NOT NULL REFERENCES task_physical_calls(id) ON DELETE CASCADE,resource_key TEXT NOT NULL,PRIMARY KEY(call_id,resource_key));
  CREATE INDEX IF NOT EXISTS task_physical_resource_keys ON task_physical_resources(resource_key,call_id);
 `);}
 busy(stepId:string){return Boolean(this.db.prepare(`SELECT 1 FROM task_physical_calls p WHERE p.state='active' AND (p.task_id=? OR EXISTS(SELECT 1 FROM task_physical_resources r JOIN execution_resources e ON e.resource_key=r.resource_key WHERE r.call_id=p.id AND e.step_id=?)) LIMIT 1`).get(stepId,stepId));}
 receipt(issuance:string){return this.db.prepare('SELECT * FROM task_physical_calls WHERE issuance_id=?').get(issuance);}
 active(userId:string){return Boolean(this.db.prepare("SELECT 1 FROM task_physical_calls WHERE user_id=? AND state='active' LIMIT 1").get(userId));}
 eraseQuiescent(userId:string){this.db.prepare("DELETE FROM task_physical_calls WHERE user_id=? AND state='quiescent'").run(userId);}
 bind(step:ExecutionStep,issuance:string){const current=this.current.getStore();if(!current)return;if(current.taskId!==step.id)throw new ExecutionFailure('stale','physical_owner_invalid');const row=this.db.prepare("SELECT * FROM task_physical_calls WHERE id=? AND task_id=? AND owner_token=? AND state='active'").get(current.id,step.id,current.token);if(!row||row.issuance_id)throw new ExecutionFailure('stale','physical_owner_invalid');this.db.prepare('UPDATE task_physical_calls SET issuance_id=? WHERE id=? AND owner_token=?').run(issuance,current.id,current.token);}
 async run<T>(step:ExecutionStep,deploymentId:string,snapshotId:string,mode:ModelRecoveryMode,admit:<V>(write:()=>V)=>V,work:()=>Promise<T>):Promise<T>{
  const nested=this.current.getStore();
  if(nested){const owner=this.db.prepare("SELECT * FROM task_physical_calls WHERE id=? AND owner_token=? AND incarnation=? AND state='active'").get(nested.id,nested.token,this.incarnation);if(!owner||nested.taskId!==step.id||owner.task_id!==step.id||owner.user_id!==step.ownership!.userId||owner.deployment_id!==deploymentId||owner.snapshot_id!==snapshotId||owner.mode!==mode||owner.attempt_id!==step.attemptId)throw new ExecutionFailure('stale','physical_owner_invalid');return work();}
  if(!step.attemptId)throw new ExecutionFailure('permanent','physical_attempt_unavailable');
  const id=randomUUID(),token=randomUUID(),attemptId=step.attemptId;
  admit(()=>{if(this.busy(step.id))throw new ExecutionFailure('waiting','physical_cleanup_pending',1000,{executionStarted:false});this.db.prepare("INSERT INTO task_physical_calls VALUES(?,?,?,?,?,?,?,?,?,'active',NULL,?,NULL)").run(id,step.id,step.ownership!.userId,deploymentId,this.incarnation,attemptId,token,snapshotId,mode,Date.now());this.db.prepare('INSERT INTO task_physical_resources SELECT ?,resource_key FROM execution_resources WHERE step_id=?').run(id,step.id);});
  try{return await this.current.run({id,token,taskId:step.id},work);}
  finally{
   // Deliberately no grant assertion here: this records only local cleanup,
   // even after cancellation. It cannot settle an issuance or publish a task.
   this.db.prepare("UPDATE task_physical_calls SET state='quiescent',quiescent_at=? WHERE id=? AND owner_token=? AND incarnation=? AND state='active'").run(Date.now(),id,token,this.incarnation);
   this.db.prepare("DELETE FROM task_physical_calls WHERE id=? AND owner_token=? AND state='quiescent' AND NOT EXISTS(SELECT 1 FROM user_tasks WHERE task_id=task_physical_calls.task_id)").run(id,token);
  }
 }
}
