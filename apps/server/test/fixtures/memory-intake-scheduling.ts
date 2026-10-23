import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import type {DatabaseSync} from 'node:sqlite';
import type {ExecutionEngine,ExecutionPoolAdmission} from '../../src/execution-engine.js';

/** Exercise a genuinely queued cohort using the existing host capacity gate.
 * Real ingress, Material publication, intake receipts and grants remain intact. */
export function holdMemoryIntake(engine:ExecutionEngine){
 const pool='memory.intake',admissions=(engine as unknown as {admissions:Map<string,ExecutionPoolAdmission>}).admissions,previous=admissions.get(pool);let released=false;
 engine.configurePool(pool,{...(previous??{lane:()=> 'background' as const,concurrency:{background:()=>2,interactive:()=>2}}),available:()=>false});
 return ()=>{if(released)return;released=true;if(previous)engine.configurePool(pool,previous);else admissions.delete(pool);engine.wake();};
}
export async function queuedMemoryIntakes(f:{read:<T>(work:(db:DatabaseSync)=>T)=>T},userId:string,count:number){
 const end=Date.now()+15000;let rows:any[]=[];
 for(;;){rows=f.read(db=>db.prepare('SELECT i.id,i.material_id,i.revision,i.json,i.job_id,i.state,e.state taskState,e.attempts FROM mm_intakes i JOIN execution_steps e ON e.id=i.task_id AND e.user_id=i.user_id WHERE i.user_id=? AND i.revoked=0 ORDER BY i.created_at,i.id').all(userId));const preparing=f.read(db=>db.prepare("SELECT 1 FROM execution_steps WHERE user_id=? AND kind IN ('memory.materials','processing.intake','processing.pipeline','processing.extract','processing.derivatives') AND state IN ('waiting','running') LIMIT 1").get(userId));if(rows.length===count&&!preparing)break;assert.ok(Date.now()<end,'exact queued Memory cohort missing '+JSON.stringify(rows));await delay(10);}
 for(const row of rows){assert.equal(row.state,'pending');assert.equal(row.job_id,null);assert.equal(row.taskState,'waiting');assert.equal(row.attempts,0);assert.ok(JSON.parse(String(row.json)).targetIds.length>0);}
 return rows;
}
