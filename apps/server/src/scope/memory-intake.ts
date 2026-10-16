import {z} from 'zod';
import {ExecutionFailure} from '../execution-engine.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import {isCaptureMemorySource} from '../capture-memory-source.js';
import {memoryRecipeBindingSchema} from '../memory-strategy-contract.js';
import type {MemoryStrategies} from '../memory-strategies.js';
import type {TaskExecution,TaskRun} from './task-execution.js';
import type {ProcessingHost} from './processing.js';
import type {UserContext} from './context.js';
import {memoryHash,type ScopedMemoryData} from './memory-data.js';
import {memoryBindingSchema,memorySettingsSchema} from './memory-schema.js';
import {PrivateDataError} from './private-data-sql.js';
const inputSchema=z.object({id:z.string().uuid()}).strict();
export const intakeReceiptSchema=z.object({generation:z.number(),settings:memorySettingsSchema,binding:memoryBindingSchema,strategy:memoryRecipeBindingSchema}).strict();
export type IntakeReceipt=z.infer<typeof intakeReceiptSchema>;
/** A synchronous receipt consumes a genuine M06 commit. Only its own M05
 * no-model grant may later acquire Memory model leases. No request context is
 * retained, and paused history never silently becomes a new authorization. */
export class MemoryIntake {
 private readonly disposers:Array<()=>void|Promise<void>>=[];
 constructor(private readonly data:(context:UserContext)=>ScopedMemoryData,private readonly execution:TaskExecution,private readonly strategies:MemoryStrategies,private readonly admit:(context:UserContext,id:string,materials:readonly {id:string;materialId:string;revision:string}[],receipt:IntakeReceipt)=>Promise<unknown>){
  this.disposers.push(execution.register({kind:'memory.intake',pool:'memory.intake',concurrency:()=>2,policy:EXECUTION_POLICIES.orchestration,parseInput:value=>inputSchema.parse(value),authorizeInput:(context,raw)=>{this.receipt(context,String(raw.id));},resources:()=>[{scope:'user',key:'memory-intake'}],execute:run=>this.execute(run),classify:error=>error instanceof ExecutionFailure?error:new ExecutionFailure('blocked','memory_intake_requires_attention')}));
 }
 bind(processing:ProcessingHost){this.disposers.push(processing.onMaterialPublished((run,material)=>this.accept(run,material)));}
 private receipt(context:UserContext,id:string){const data=this.data(context),row=data.sql.get('SELECT * FROM mm_intakes WHERE user_id=$user AND id=?',id);if(!row||row.revoked||row.state==='skipped')throw new PrivateDataError('conflict',409);const receipt=intakeReceiptSchema.parse(JSON.parse(String(row.json)));if(data.state().generation!==receipt.generation||memoryHash(data.binding())!==memoryHash(receipt.binding))throw new PrivateDataError('conflict',409);data.materialEvidence(String(row.material_id),String(row.revision));return {data,row,receipt};}
 private accept(run:TaskRun,material:Readonly<{id:string;revision:string}>){
  run.grant.assert();const data=this.data(run.context),state=data.state(),settings=memorySettingsSchema.parse(JSON.parse(state.settings)),manifest=data.privateData.material(material.id,material.revision);
  const source=data.privateData.source(manifest.origin.sourceId),refs=settings.sourceRecipes[manifest.origin.sourceId]??(isCaptureMemorySource(source.id,source.deviceId)?settings.captureRecipes:source.kind==='lark-docs'?settings.documentRecipes:settings.recipes??[settings.profile==='coding'?settings.codingRecipe:settings.recipe]),bindings=refs.map(ref=>this.strategies.resolve(ref).binding);
  for(const strategy of bindings){
   const identity=memoryHash([material.id,material.revision,strategy]),id=identity.slice(0,8)+'-'+identity.slice(8,12)+'-5'+identity.slice(13,16)+'-a'+identity.slice(17,20)+'-'+identity.slice(20,32);
   if(data.sql.get('SELECT id FROM mm_intakes WHERE user_id=$user AND id=?',id))continue;
   const allowed=Boolean(state.desired&&settings.automatic&&!data.sql.get('SELECT 1 FROM mm_binding_locks WHERE user_id=$user'));
   data.sql.run('INSERT INTO mm_intakes VALUES($user,?,?,?,?,0,NULL,NULL,?,?)',id,material.id,material.revision,JSON.stringify({generation:state.generation,settings,binding:data.binding(),strategy}),new Date().toISOString(),allowed?'pending':'skipped');
   if(allowed){const task=this.execution.forUser(run.context).submitSync({kind:'memory.intake',operationId:'memory-intake:'+identity,input:{id}});data.sql.run('UPDATE mm_intakes SET task_id=? WHERE user_id=$user AND id=?',task.id,id);}
  }
 }
 private async execute(run:TaskRun){
  const {id}=inputSchema.parse(run.task.input),{data,row,receipt}=this.receipt(run.context,id);if(row.state==='complete')return {retained:true};
  const policy=receipt.settings.lifecycle.extraction,count=Number(data.sql.get("SELECT count(*) n FROM mm_intakes WHERE user_id=$user AND revoked=0 AND state='pending' AND json=?",row.json)!.n),due=Date.parse(String(row.created_at))+(policy.maxWaitHours??policy.intervalHours)*3600000;
  if(!row.job_id&&count<policy.minChanges&&Date.now()<due&&!data.sql.get('SELECT 1 FROM mm_binding_locks WHERE user_id=$user'))throw new ExecutionFailure('waiting','memory_window_pending',Math.min(due-Date.now(),60000),{executionStarted:false});
  const selected=row.job_id?data.sql.all('SELECT * FROM mm_intakes WHERE user_id=$user AND job_id=? ORDER BY created_at,id',row.job_id):data.sql.all("SELECT * FROM mm_intakes WHERE user_id=$user AND revoked=0 AND state='pending' AND job_id IS NULL AND json=? ORDER BY created_at,id LIMIT ?",row.json,policy.maxItems),jobId=String(row.job_id??id);
  const materials=selected.map(item=>({id:String(item.id),materialId:String(item.material_id),revision:String(item.revision)}));
  run.grant.commit(()=>{for(const item of materials){this.receipt(run.context,item.id);data.sql.run('UPDATE mm_intakes SET job_id=? WHERE user_id=$user AND id=?',jobId,item.id);}});
  const result=await this.admit(run.context,jobId,materials,receipt);run.grant.assert();
  run.grant.commit(()=>{for(const item of materials){this.receipt(run.context,item.id);data.sql.run("UPDATE mm_intakes SET state='complete' WHERE user_id=$user AND id=?",item.id);}});return result;
 }
 async close(){for(const dispose of this.disposers.reverse())await dispose();}
}
