import {z} from 'zod';
import {ExecutionFailure} from '../execution-engine.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import type {Memory} from '../memory-schema.js';
import type {UserContext} from './context.js';
import type {TaskExecution,TaskRun} from './task-execution.js';
import {memoryHash,type ScopedMemoryData} from './memory-data.js';
import {memoryBindingSchema,memorySettingsSchema,type ScopedMemoryTask} from './memory-schema.js';
import {PrivateDataError} from './private-data-sql.js';
const request=z.object({id:z.string().uuid()}).strict();
export const integrationWindowSchema=z.object({generation:z.number().int(),settings:memorySettingsSchema,binding:memoryBindingSchema,selection:z.array(z.object({id:z.string().uuid(),version:z.number().int().positive(),fingerprint:z.string()})).optional()}).strict();
export type IntegrationWindow=z.infer<typeof integrationWindowSchema>;
/** Existing consolidation policy and M05 scheduling, with a durable per-user
 * watermark. The window never uses another user's same-name entity as context. */
export class MemoryIntegration {
 private readonly dispose:()=>Promise<void>;
 constructor(private readonly data:(context:UserContext)=>ScopedMemoryData,private readonly execution:TaskExecution,private readonly admit:(context:UserContext,id:string,materials:string[],memories:string[],window:IntegrationWindow)=>Promise<unknown>){
  this.dispose=execution.register({kind:'memory.integration-window',pool:'memory.intake',concurrency:()=>2,policy:EXECUTION_POLICIES.orchestration,parseInput:raw=>request.parse(raw),authorizeInput:(context,raw)=>{this.window(context,String(raw.id));},resources:()=>[{scope:'user',key:'memory-intake'}],execute:run=>this.execute(run),classify:error=>error instanceof ExecutionFailure?error:new ExecutionFailure('blocked','memory_integration_requires_attention')});
 }
 private window(context:UserContext,id:string){const data=this.data(context),row=data.sql.get('SELECT * FROM mm_integration_windows WHERE user_id=$user AND id=?',id);if(!row||row.revoked)throw new PrivateDataError('conflict',409);const window=integrationWindowSchema.parse(JSON.parse(String(row.json)));if(data.state().generation!==window.generation||memoryHash(data.binding())!==memoryHash(window.binding))throw new PrivateDataError('conflict',409);return {data,row,window};}
 published(run:TaskRun,input:ScopedMemoryTask,memories:readonly Memory[]){
  if(input.phase!=='extract'&&!input.action)return;const data=this.data(run.context),state=data.state(),settings=memorySettingsSchema.parse(JSON.parse(state.settings));if(input.batchId){if(data.sql.get('SELECT state FROM mm_jobs WHERE user_id=$user AND id=?',input.jobId)?.state!=='committed')return;memories=data.sql.all('SELECT prepared FROM mm_job_batches WHERE user_id=$user AND job_id=?',input.jobId).flatMap(row=>JSON.parse(String(row.prepared)).items);}if(!memories.length)return;
  if(data.sql.get('SELECT 1 FROM mm_binding_locks WHERE user_id=$user')||!state.desired||!settings.automatic||!settings.integration||!settings.lifecycle.consolidation.enabled){for(const memory of memories)data.sql.run('INSERT OR IGNORE INTO mm_integrated_versions VALUES($user,?,?,?,?)',memory.id,memory.version,memory.fingerprint,'skipped:'+input.jobId);return;}
  if(data.sql.get('SELECT 1 FROM mm_integration_windows WHERE user_id=$user AND id=?',input.jobId))return;
  const value={generation:state.generation,settings,binding:data.binding()};data.sql.run("INSERT INTO mm_integration_windows VALUES($user,?,?,0,NULL,NULL,'pending',?)",input.jobId,JSON.stringify(value),new Date().toISOString());
  const task=this.execution.forUser(run.context).submitSync({kind:'memory.integration-window',operationId:'memory-integration-window:'+input.jobId,input:{id:input.jobId}});data.sql.run('UPDATE mm_integration_windows SET task_id=? WHERE user_id=$user AND id=?',task.id,input.jobId);
 }
 private async execute(run:TaskRun){
  const {id}=request.parse(run.task.input),{data,row,window}=this.window(run.context,id);if(row.state==='complete')return {retained:true};
  const policy=window.settings.lifecycle.consolidation,candidates=data.sql.all("SELECT r.* FROM mm_records r WHERE r.user_id=$user AND json_extract(r.json,'$.status')='published' AND json_extract(r.json,'$.tier')='episode' AND json_extract(r.json,'$.domain')=? AND json_extract(r.json,'$.supersededBy') IS NULL AND NOT EXISTS(SELECT 1 FROM mm_integrated_versions v WHERE v.user_id=$user AND v.id=r.id AND v.version=r.version AND v.fingerprint=r.fingerprint) ORDER BY r.created_at,r.id",window.settings.profile),valid=candidates.flatMap(row=>{try{data.assertCurrentRecord(row as any);return [row];}catch{return [];}}),due=Date.parse(String(row.created_at))+(policy.maxWaitHours??policy.intervalHours)*3600000;
  if(!window.selection&&valid.length<policy.minChanges&&data.sql.get('SELECT 1 FROM mm_binding_locks WHERE user_id=$user')){run.grant.commit(()=>data.sql.run("UPDATE mm_integration_windows SET state='complete' WHERE user_id=$user AND id=?",id));return {deferred:true};}
  if(!window.selection&&valid.length<policy.minChanges&&Date.now()<due&&!data.sql.get('SELECT 1 FROM mm_binding_locks WHERE user_id=$user'))throw new ExecutionFailure('waiting','memory_integration_window_pending',Math.min(due-Date.now(),60000),{executionStarted:false});
  const selection=window.selection??valid.slice(0,policy.maxItems).map(row=>({id:String(row.id),version:Number(row.version),fingerprint:String(row.fingerprint)}));
  if(!selection.length){run.grant.commit(()=>data.sql.run("UPDATE mm_integration_windows SET state='complete' WHERE user_id=$user AND id=?",id));return {empty:true};}
  run.grant.commit(()=>{for(const pin of selection){const current=data.row(pin.id);data.assertCurrentRecord(current);if(current.version!==pin.version||current.fingerprint!==pin.fingerprint)throw new PrivateDataError('conflict',409);data.sql.run('INSERT OR IGNORE INTO mm_integrated_versions VALUES($user,?,?,?,?)',pin.id,pin.version,pin.fingerprint,id);}data.sql.run('UPDATE mm_integration_windows SET json=? WHERE user_id=$user AND id=?',JSON.stringify({...window,selection}),id);});
  const materialIds=[...new Set(selection.flatMap(pin=>data.sql.all('SELECT DISTINCT e.material_id FROM mm_dependencies d JOIN mm_evidence e ON e.user_id=d.user_id AND e.id=d.evidence_id WHERE d.user_id=$user AND e.user_id=$user AND d.memory_id=?',pin.id).map(row=>String(row.material_id))))],jobId=id;
  const result=await this.admit(run.context,jobId,materialIds,selection.map(pin=>pin.id),{...window,selection});run.grant.assert();this.window(run.context,id);run.grant.commit(()=>data.sql.run("UPDATE mm_integration_windows SET state='complete',job_id=? WHERE user_id=$user AND id=?",z.object({id:z.string().uuid()}).passthrough().parse(result).id,id));return result;
 }
 async close(){await this.dispose();}
}
