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
 /** A genuinely scheduled task must acquire its own owner, even when its
  * scheduler was awaited from inside another task's model callback. */
 taskBoundary<T>(work:()=>T):T{return this.current.exit(work);}
 bind(step:ExecutionStep,issuance:string,previous?:{state:string;issuance:string|null}){
  const current=this.current.getStore();if(!current)return;
  const invalid=()=>new ExecutionFailure('stale','physical_owner_invalid');if(current.taskId!==step.id)throw invalid();
  const row=this.db.prepare("SELECT * FROM task_physical_calls WHERE id=? AND task_id=? AND owner_token=? AND incarnation=? AND state='active'").get(current.id,step.id,current.token,this.incarnation);
  if(!row||row.user_id!==step.ownership?.userId||row.attempt_id!==step.attemptId)throw invalid();
  if(!row.issuance_id){this.db.prepare('UPDATE task_physical_calls SET issuance_id=? WHERE id=? AND owner_token=?').run(issuance,current.id,current.token);return;}
  // A serial media recipe may finish one exact request before issuing the next
  // inside the same full callback. Keep every binding immutable; the shared
  // cleanup capability still attests only the end of that complete callback.
  if(row.mode!=='reconcile'||previous?.state!=='succeeded'||!previous.issuance)throw invalid();
  const predecessor=this.receipt(previous.issuance),identity=['task_id','user_id','deployment_id','incarnation','attempt_id','owner_token','snapshot_id','mode'];
  if(!predecessor||predecessor.state!=='active'||identity.some(key=>predecessor[key]!==row[key]))throw invalid();
  const unsettled=this.db.prepare("SELECT 1 FROM task_physical_calls p LEFT JOIN task_external_calls c ON c.issuance_id=p.issuance_id AND c.task_id=p.task_id AND c.user_id=p.user_id WHERE p.owner_token=? AND p.incarnation=? AND p.issuance_id IS NOT NULL AND (c.state IS NULL OR c.state<>'succeeded' OR c.settled_at IS NULL) LIMIT 1").get(current.token,this.incarnation);
  if(unsettled)throw invalid();
  const id=randomUUID();this.db.prepare("INSERT INTO task_physical_calls VALUES(?,?,?,?,?,?,?,?,?,'active',?,?,NULL)").run(id,row.task_id,row.user_id,row.deployment_id,row.incarnation,row.attempt_id,row.owner_token,row.snapshot_id,row.mode,issuance,Date.now());
  this.db.prepare('INSERT INTO task_physical_resources SELECT ?,resource_key FROM task_physical_resources WHERE call_id=?').run(id,current.id);
 }
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
   const cohort=[step.id,step.ownership!.userId,deploymentId,this.incarnation,attemptId,token,snapshotId,mode];
   this.db.prepare("UPDATE task_physical_calls SET state='quiescent',quiescent_at=? WHERE task_id=? AND user_id=? AND deployment_id=? AND incarnation=? AND attempt_id=? AND owner_token=? AND snapshot_id=? AND mode=? AND state='active'").run(Date.now(),...cohort);
   this.db.prepare("DELETE FROM task_physical_calls WHERE task_id=? AND user_id=? AND deployment_id=? AND incarnation=? AND attempt_id=? AND owner_token=? AND snapshot_id=? AND mode=? AND state='quiescent' AND NOT EXISTS(SELECT 1 FROM user_tasks WHERE task_id=task_physical_calls.task_id)").run(...cohort);
  }
 }
}
