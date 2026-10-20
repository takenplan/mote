import {z} from 'zod';
import {ExecutionFailure} from '../execution-engine.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import type {Memory} from '../memory-schema.js';
import type {UserContext} from './context.js';
import type {TaskExecution,TaskRun} from './task-execution.js';
import {memoryHash,memoryUUID,type MemoryRow,type ScopedMemoryData} from './memory-data.js';
import {memoryBindingSchema,memorySettingsSchema,type ScopedMemoryTask} from './memory-schema.js';
import {PrivateDataError} from './private-data-sql.js';
const request=z.object({id:z.string().uuid()}).strict();
const memoryPin=z.object({id:z.string().uuid(),version:z.number().int().positive(),fingerprint:z.string()}).strict();
export const integrationWindowSchema=z.object({generation:z.number().int(),settings:memorySettingsSchema,binding:memoryBindingSchema,selection:z.array(memoryPin).optional(),pending:z.array(memoryPin).optional()}).strict();
export type IntegrationWindow=z.infer<typeof integrationWindowSchema>;
/** Scheduling and owner observations must describe the same selected set.
 * A continuation can read only its original window's frozen remaining pins;
 * newer arrivals and another account's same-name cards never widen it. */
export function integrationCandidates(data:ScopedMemoryData,window:IntegrationWindow):MemoryRow[]{
 const candidates=window.pending?window.pending.flatMap(pin=>{try{const row=data.row(pin.id);return row.version===pin.version&&row.fingerprint===pin.fingerprint?[row]:[];}catch{return [];}}):data.sql.all("SELECT r.* FROM mm_records r WHERE r.user_id=$user AND json_extract(r.json,'$.status')='published' AND json_extract(r.json,'$.tier')='episode' AND json_extract(r.json,'$.admission.layer')='memory' AND json_extract(r.json,'$.supersededBy') IS NULL AND NOT EXISTS(SELECT 1 FROM mm_integrated_versions v WHERE v.user_id=$user AND v.id=r.id AND v.version=r.version AND v.fingerprint=r.fingerprint) ORDER BY r.created_at,r.id") as MemoryRow[];
 return candidates.filter(row=>{try{const memory=data.assertCurrentRecord(row);return memory.tier==='episode'&&memory.admission?.layer==='memory'&&!memory.supersededBy;}catch{return false;}});
}
export function integrationDueAt(createdAt:string,window:IntegrationWindow){const policy=window.settings.lifecycle.consolidation;return Date.parse(createdAt)+(policy.maxWaitHours??Math.min(policy.intervalHours,1))*3600000;}
/** Existing consolidation policy and M05 scheduling, with a durable per-user
 * watermark. The window never uses another user's same-name entity as context. */
export class MemoryIntegration {
 private readonly dispose:()=>Promise<void>;
 constructor(private readonly data:(context:UserContext)=>ScopedMemoryData,private readonly execution:TaskExecution,private readonly admit:(context:UserContext,id:string,materials:string[],memories:string[],window:IntegrationWindow)=>Promise<unknown>){
  this.dispose=execution.register({kind:'memory.integration-window',pool:'memory.intake',concurrency:()=>2,policy:EXECUTION_POLICIES.orchestration,parseInput:raw=>request.parse(raw),authorizeInput:(context,raw)=>{this.window(context,String(raw.id));},resources:()=>[{scope:'user',key:'memory-intake'}],execute:run=>this.execute(run),classify:error=>error instanceof ExecutionFailure?error:new ExecutionFailure('blocked','memory_integration_requires_attention')});
 }
 private window(context:UserContext,id:string){const data=this.data(context),row=data.sql.get('SELECT * FROM mm_integration_windows WHERE user_id=$user AND id=?',id);if(!row||row.revoked)throw new PrivateDataError('conflict',409);const window=integrationWindowSchema.parse(JSON.parse(String(row.json)));if(data.state().generation!==window.generation||memoryHash(data.binding())!==memoryHash(window.binding))throw new PrivateDataError('conflict',409);return {data,row,window};}
 published(run:TaskRun,input:ScopedMemoryTask,memories:readonly Memory[]){
  if(input.phase!=='extract'&&!input.action)return;const data=this.data(run.context),state=data.state(),settings=memorySettingsSchema.parse(JSON.parse(state.settings));if(input.batchId){if(data.sql.get('SELECT state FROM mm_jobs WHERE user_id=$user AND id=?',input.jobId)?.state!=='committed')return;memories=data.sql.all('SELECT prepared FROM mm_job_batches WHERE user_id=$user AND job_id=?',input.jobId).flatMap(row=>JSON.parse(String(row.prepared)).items);}memories=memories.filter(memory=>memory.admission?.layer==='memory');if(!memories.length)return;
  if(data.sql.get('SELECT 1 FROM mm_binding_locks WHERE user_id=$user')||!state.desired||!settings.automatic||!settings.integration||!settings.lifecycle.consolidation.enabled){for(const memory of memories)data.sql.run('INSERT OR IGNORE INTO mm_integrated_versions VALUES($user,?,?,?,?)',memory.id,memory.version,memory.fingerprint,'skipped:'+input.jobId);return;}
  if(data.sql.get('SELECT 1 FROM mm_integration_windows WHERE user_id=$user AND id=?',input.jobId))return;
  const value={generation:state.generation,settings,binding:data.binding()};data.sql.run("INSERT INTO mm_integration_windows VALUES($user,?,?,0,NULL,NULL,'pending',?)",input.jobId,JSON.stringify(value),new Date().toISOString());
  const task=this.execution.forUser(run.context).submitSync({kind:'memory.integration-window',operationId:'memory-integration-window:'+input.jobId,input:{id:input.jobId}});data.sql.run('UPDATE mm_integration_windows SET task_id=? WHERE user_id=$user AND id=?',task.id,input.jobId);
 }
 private async execute(run:TaskRun){
  const {id}=request.parse(run.task.input),{data,row,window}=this.window(run.context,id);if(row.state==='complete')return {retained:true};
  // The extraction profile chooses a recipe, never the meaning of its results.
  // Both model-selected domains share this frozen window; the owned Memory job
  // gives each actual domain its own draft, review and publication checkpoint.
  // Searchable observations remain outside long-term consolidation entirely.
  const policy=window.settings.lifecycle.consolidation,valid=integrationCandidates(data,window),due=integrationDueAt(String(row.created_at),window);
  if(!window.selection&&valid.length<policy.minChanges&&data.sql.get('SELECT 1 FROM mm_binding_locks WHERE user_id=$user')){run.grant.commit(()=>data.sql.run("UPDATE mm_integration_windows SET state='complete' WHERE user_id=$user AND id=?",id));return {deferred:true};}
  if(!window.selection&&valid.length<policy.minChanges&&Date.now()<due&&!data.sql.get('SELECT 1 FROM mm_binding_locks WHERE user_id=$user'))throw new ExecutionFailure('waiting','memory_integration_window_pending',Math.min(due-Date.now(),60000),{executionStarted:false});
  const pins=valid.map(row=>({id:String(row.id),version:Number(row.version),fingerprint:String(row.fingerprint)})),pending=window.selection?window.pending??pins:pins,selection=window.selection??pins.slice(0,policy.maxItems),frozen={...window,pending,selection};
  if(!selection.length){run.grant.commit(()=>data.sql.run("UPDATE mm_integration_windows SET state='complete' WHERE user_id=$user AND id=?",id));return {empty:true};}
  run.grant.commit(()=>{for(const pin of pending){if(!window.selection||selection.some(selected=>selected.id===pin.id)){const current=data.row(pin.id);data.assertCurrentRecord(current);if(current.version!==pin.version||current.fingerprint!==pin.fingerprint)throw new PrivateDataError('conflict',409);}data.sql.run('INSERT OR IGNORE INTO mm_integrated_versions VALUES($user,?,?,?,?)',pin.id,pin.version,pin.fingerprint,id);}data.sql.run('UPDATE mm_integration_windows SET json=? WHERE user_id=$user AND id=?',JSON.stringify(frozen),id);});
  const materialIds=[...new Set(selection.flatMap(pin=>data.sql.all('SELECT DISTINCT e.material_id FROM mm_dependencies d JOIN mm_evidence e ON e.user_id=d.user_id AND e.id=d.evidence_id WHERE d.user_id=$user AND e.user_id=$user AND d.memory_id=?',pin.id).map(row=>String(row.material_id))))],jobId=id;
  const result=await this.admit(run.context,jobId,materialIds,selection.map(pin=>pin.id),frozen);run.grant.assert();this.window(run.context,id);
  const child=z.object({id:z.string().uuid(),tasks:z.record(z.object({id:z.string()}).passthrough())}).passthrough().parse(result);
  run.grant.commit(()=>{
   const remaining=pending.filter(pin=>!selection.some(selected=>selected.id===pin.id&&selected.version===pin.version&&selected.fingerprint===pin.fingerprint));
   if(remaining.length){
    const nextId=memoryUUID([id,'integration-continuation',remaining]),next:IntegrationWindow={generation:window.generation,settings:window.settings,binding:window.binding,pending:remaining};
    data.sql.run("INSERT OR IGNORE INTO mm_integration_windows VALUES($user,?,?,0,NULL,NULL,'pending',?)",nextId,JSON.stringify(next),String(row.created_at));
    const task=this.execution.forUser(run.context).submitSync({kind:'memory.integration-window',operationId:'memory-integration-window:'+nextId,input:{id:nextId},dependencies:Object.entries(child.tasks).filter(([stage])=>stage==='batch'||stage.startsWith('batch:')).map(([,task])=>task.id)});
    data.sql.run('UPDATE mm_integration_windows SET task_id=? WHERE user_id=$user AND id=?',task.id,nextId);
   }
   data.sql.run("UPDATE mm_integration_windows SET state='complete',job_id=? WHERE user_id=$user AND id=?",child.id,id);
  });return result;
 }
 async close(){await this.dispose();}
}
