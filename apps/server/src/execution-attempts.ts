import type {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {executionRetryBudget} from '@mote/shared';

export type AttemptSession={id:string;round:number;charged:number;executed:number;pending:number;open:number};
/** A logical attempt survives resource suspension, independently of its short
 * execution lease. Only an explicit owner action starts another finite round. */
export class ExecutionAttempts {
 constructor(private db:DatabaseSync){db.exec(`
  CREATE TABLE IF NOT EXISTS execution_retry_policies(step_id TEXT PRIMARY KEY REFERENCES execution_steps(id) ON DELETE CASCADE,max_attempts INTEGER NOT NULL,round INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS execution_attempt_sessions(id TEXT PRIMARY KEY,step_id TEXT NOT NULL REFERENCES execution_steps(id) ON DELETE CASCADE,round INTEGER NOT NULL,charged INTEGER NOT NULL DEFAULT 0,executed INTEGER NOT NULL DEFAULT 0,pending INTEGER NOT NULL DEFAULT 0,open INTEGER NOT NULL DEFAULT 1);
  CREATE UNIQUE INDEX IF NOT EXISTS execution_open_attempt ON execution_attempt_sessions(step_id) WHERE open=1;
  CREATE TABLE IF NOT EXISTS execution_retry_rounds(id TEXT PRIMARY KEY,step_id TEXT NOT NULL REFERENCES execution_steps(id) ON DELETE CASCADE,round INTEGER NOT NULL,attempts INTEGER NOT NULL,reset_at INTEGER NOT NULL);
 `);}
 policy(stepId:string,max:number){this.db.prepare('INSERT INTO execution_retry_policies(step_id,max_attempts) VALUES(?,?) ON CONFLICT(step_id) DO UPDATE SET max_attempts=excluded.max_attempts').run(stepId,max);}
 current(stepId:string){return this.db.prepare('SELECT * FROM execution_attempt_sessions WHERE step_id=? AND open=1').get(stepId) as AttemptSession|undefined;}
 open(stepId:string){let session=this.current(stepId);if(!session){const round=Number(this.db.prepare('SELECT round FROM execution_retry_policies WHERE step_id=?').get(stepId)!.round),id=randomUUID();this.db.prepare('INSERT INTO execution_attempt_sessions(id,step_id,round) VALUES(?,?,?)').run(id,stepId,round);session=this.current(stepId)!;}return session;}
 charge(stepId:string,id:string,max:number){
  const session=this.db.prepare('SELECT * FROM execution_attempt_sessions WHERE id=? AND step_id=? AND open=1').get(id,stepId) as AttemptSession|undefined;
  if(!session)throw Error('Attempt session unavailable');
  if(session.charged)return false;
  if(Number(this.db.prepare('SELECT attempts FROM execution_steps WHERE id=?').get(stepId)!.attempts)>=max)return undefined;
  this.db.prepare('UPDATE execution_steps SET attempts=attempts+1 WHERE id=?').run(stepId);this.db.prepare('UPDATE execution_attempt_sessions SET charged=1 WHERE id=?').run(id);return true;
 }
 executed(id:string){return Boolean(this.db.prepare('SELECT executed FROM execution_attempt_sessions WHERE id=?').get(id)?.executed);}
 recordExecution(id:string){this.db.prepare('UPDATE execution_attempt_sessions SET executed=1 WHERE id=?').run(id);}
 enter(id:string){this.db.prepare('UPDATE execution_attempt_sessions SET pending=pending+1 WHERE id=?').run(id);}
 /** Exact callback facts may finish after its lease. They cannot publish or
  * refund a closed attempt, nor touch a newer session or round. */
 finish(id:string,executed:boolean){this.db.prepare('UPDATE execution_attempt_sessions SET pending=max(0,pending-1),executed=max(executed,?) WHERE id=?').run(Number(executed),id);}
 refundWaiting(stepId:string,id:string){
  const session=this.db.prepare('SELECT * FROM execution_attempt_sessions WHERE id=? AND step_id=? AND open=1').get(id,stepId) as AttemptSession|undefined;
  if(!session?.charged||session.executed||session.pending)return false;
  this.db.prepare('UPDATE execution_steps SET attempts=max(0,attempts-1) WHERE id=?').run(stepId);this.db.prepare('UPDATE execution_attempt_sessions SET charged=0 WHERE id=?').run(id);return true;
 }
 close(stepId:string){this.db.prepare('UPDATE execution_attempt_sessions SET open=0 WHERE step_id=? AND open=1').run(stepId);}
 reset(stepId:string,now:number){const row=this.db.prepare('SELECT p.round,e.attempts FROM execution_retry_policies p JOIN execution_steps e ON e.id=p.step_id WHERE e.id=?').get(stepId);if(!row)return;this.close(stepId);this.db.prepare('INSERT INTO execution_retry_rounds VALUES(?,?,?,?,?)').run(randomUUID(),stepId,row.round,row.attempts,now);this.db.prepare('UPDATE execution_retry_policies SET round=round+1 WHERE step_id=?').run(stepId);}
 describe(stepId:string,attempts:number,state:string){const row=this.db.prepare('SELECT p.max_attempts,p.round,s.id attempt_id,s.charged FROM execution_retry_policies p LEFT JOIN execution_attempt_sessions s ON s.step_id=p.step_id AND s.open=1 WHERE p.step_id=?').get(stepId);if(!row)return {};return {...executionRetryBudget(attempts,Number(row.max_attempts),Number(row.round),Boolean(row.charged),state==='succeeded'),...(row.attempt_id?{attemptId:String(row.attempt_id)}:{})};}

}
