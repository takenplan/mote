import {z} from 'zod';
import {ExecutionFailure} from '../execution-engine.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import {materialDependencyStatus} from '../material-readiness.js';
import type {IngressHost} from './ingress.js';
import {isCaptureMemorySource} from '../capture-memory-source.js';
import {memoryRecipeBindingSchema} from '../memory-strategy-contract.js';
import type {MemoryStrategies} from '../memory-strategies.js';
import type {TaskExecution,TaskRun} from './task-execution.js';
import type {ProcessingHost} from './processing.js';
import type {UserContext} from './context.js';
import {memoryHash,type ScopedMemoryData} from './memory-data.js';
import {memoryBindingSchema,memorySettingsSchema} from './memory-schema.js';
import {PrivateDataError,type PrivateSql} from './private-data-sql.js';
import {freezeMemoryEvaluationTime,memoryEvaluationTimeSchema,memoryIntakePolicy} from './memory-evaluation-context.js';
const inputSchema=z.object({id:z.string().uuid()}).strict();
export const intakeReceiptSchema=z.object({evaluationTime:memoryEvaluationTimeSchema,generation:z.number(),settings:memorySettingsSchema,binding:memoryBindingSchema,strategy:memoryRecipeBindingSchema,required:z.array(z.string().min(1)).min(1).optional()}).strict();
export type IntakeReceipt=z.infer<typeof intakeReceiptSchema>;
/** A synchronous receipt consumes a genuine M06 commit. Only its own M05
 * no-model grant may later acquire Memory model leases. No request context is
 * retained, and paused history never silently becomes a new authorization. */
export class MemoryIntake {
 private readonly disposers:Array<()=>void|Promise<void>>=[];
 constructor(private readonly data:(context:UserContext)=>ScopedMemoryData,private readonly execution:TaskExecution,private readonly strategies:MemoryStrategies,private readonly admit:(context:UserContext,id:string,materials:readonly {id:string;materialId:string;revision:string;evaluationTime:string}[],receipt:IntakeReceipt)=>Promise<unknown>,private readonly clock:()=>string=()=>new Date().toISOString()){
  this.disposers.push(execution.register({kind:'memory.intake',pool:'memory.intake',concurrency:()=>2,policy:EXECUTION_POLICIES.orchestration,parseInput:value=>inputSchema.parse(value),authorizeInput:(context,raw)=>{this.receipt(context,String(raw.id));},resources:()=>[{scope:'user',key:'memory-intake'}],execute:run=>this.execute(run),classify:error=>error instanceof ExecutionFailure?error:new ExecutionFailure('blocked','memory_intake_requires_attention')}));
 }
 bind(processing:ProcessingHost){this.disposers.push(processing.onMaterialPublished((run,material,origin)=>{const original=this.data(run.context).sql.get('SELECT capture_id FROM ig_originals WHERE user_id=$user AND id=?',origin.originalRef.slice(9));if(!original)throw new PrivateDataError('conflict',409);this.accept(run,material,{captureId:String(original.capture_id)});}));}
 bindIngress(ingress:IngressHost){this.disposers.push(ingress.onAccepted((context,receipt)=>{const data=this.data(context),state=data.state(),settings=memorySettingsSchema.parse(JSON.parse(state.settings)),source=data.privateData.source(receipt.sourceId),refs=settings.sourceRecipes[source.id]??(isCaptureMemorySource(source.id,source.deviceId)?settings.captureRecipes:source.kind==='lark-docs'?settings.documentRecipes:settings.recipes??[settings.profile==='coding'?settings.codingRecipe:settings.recipe]),strategies=refs.map(ref=>this.strategies.resolve(ref).binding),allowed=Boolean(state.desired&&settings.automatic&&!data.sql.get('SELECT 1 FROM mm_binding_locks WHERE user_id=$user'));
  for(const item of receipt.captures)if(!item.duplicate)data.sql.run('INSERT OR IGNORE INTO mm_capture_intakes VALUES($user,?,?,?,?)',item.id,source.id,JSON.stringify({evaluationTime:freezeMemoryEvaluationTime(this.clock),generation:state.generation,settings,binding:data.binding(),strategies}),Number(!allowed));
 }));}
 private receipt(context:UserContext,id:string){const data=this.data(context),row=data.sql.get('SELECT * FROM mm_intakes WHERE user_id=$user AND id=?',id);if(!row||row.revoked||row.state==='skipped')throw new PrivateDataError('conflict',409);const receipt=intakeReceiptSchema.parse(JSON.parse(String(row.json)));if(data.state().generation!==receipt.generation||memoryHash(data.binding())!==memoryHash(receipt.binding))throw new PrivateDataError('conflict',409);data.materialEvidence(String(row.material_id),String(row.revision),undefined,receipt.required??receipt.strategy.requires??['material']);return {data,row,receipt};}
 accept(run:TaskRun,material:Readonly<{id:string;revision:string}>,origin:Readonly<{captureId:string}>){
  run.grant.assert();const data=this.data(run.context),state=data.state(),settings=memorySettingsSchema.parse(JSON.parse(state.settings)),manifest=data.privateData.material(material.id,material.revision);
  if(manifest.origin.sourceId==='mote-owner-memory-corrections')return;
  // For raw screen/UI captures the existing organizers own the ordinary and
  // daily consumption identities. M06 products are their inputs, not a second
  // automatic Memory request. Source-item/file Materials retain their intake.
  if(data.sql.get('SELECT c.capture_id FROM pd_material_captures c JOIN ig_capture_scopes s ON s.user_id=c.user_id AND s.capture_id=c.capture_id WHERE c.user_id=$user AND s.user_id=$user AND c.material_id=? AND c.revision=? LIMIT 1',material.id,material.revision)&&data.sql.get('SELECT material_id FROM mp_publications WHERE user_id=$user AND material_id=? UNION SELECT material_id FROM mp_derivations WHERE user_id=$user AND material_id=?',material.id,material.id))return;
  const captures=data.sql.all('WITH RECURSIVE tree(id,revision) AS(SELECT ?,? UNION SELECT p.input_material_id,p.input_revision FROM pd_material_inputs p JOIN tree t ON p.material_id=t.id AND p.revision=t.revision WHERE p.user_id=$user) SELECT DISTINCT c.capture_id FROM pd_material_captures c JOIN tree t ON t.id=c.material_id AND t.revision=c.revision WHERE c.user_id=$user',material.id,material.revision),frozen=captures.map(item=>data.sql.get('SELECT * FROM mm_capture_intakes WHERE user_id=$user AND capture_id=?',item.capture_id));
  // Publication is not new source intake. Every constituent must carry the same
  // durable original authorization; replays, rebuilds and paused history cannot
  // acquire a grant just because configuration later changed.
  if(!frozen.length||frozen.some(row=>!row||row.revoked)||frozen.some(row=>{const {revokedRecipes:_,...policy}=memoryIntakePolicy(JSON.parse(String(row!.json))),{revokedRecipes:__,...first}=memoryIntakePolicy(JSON.parse(String(frozen[0]!.json)));return memoryHash(policy)!==memoryHash(first);}))return;
  if(!captures.some(item=>item.capture_id===origin.captureId))throw new PrivateDataError('conflict',409);
  const producer=data.sql.get('SELECT json FROM mm_capture_intakes WHERE user_id=$user AND capture_id=?',origin.captureId);if(!producer)throw new PrivateDataError('conflict',409);
  const evaluationTime=memoryEvaluationTimeSchema.parse(JSON.parse(String(producer.json)).evaluationTime),policy=JSON.parse(String(frozen[0]!.json)),bindings=policy.strategies as IntakeReceipt['strategy'][];
  for(const strategy of bindings){
   if(frozen.some(row=>JSON.parse(String(row!.json)).revokedRecipes?.includes(memoryHash(strategy.recipe))))continue;
   const daily=Boolean(strategy.requires?.includes('daily-events'));
   if(manifest.kind==='mote.capture-event'&&!daily||manifest.kind!=='mote.capture-event'&&daily&&!manifest.artifacts?.some(item=>item.key==='daily-events'))continue;
   const required=strategy.requires??(manifest.kind==='mote.ui-page-object'?['source-body']:manifest.kind==='mote.screen-segment'?(manifest.artifacts?.some(item=>item.key==='image-original')?['image-original',...(manifest.artifacts.some(item=>item.key==='image-ocr')?['image-ocr']:[]),...(manifest.artifacts.some(item=>item.key==='image-understanding')?['image-understanding']:[])]:['ocr']):['material']);
   if(!materialDependencyStatus(manifest,required).ready)continue;

   const identity=memoryHash([material.id,material.revision,strategy]),id=identity.slice(0,8)+'-'+identity.slice(8,12)+'-5'+identity.slice(13,16)+'-a'+identity.slice(17,20)+'-'+identity.slice(20,32);
   if(data.sql.get('SELECT id FROM mm_intakes WHERE user_id=$user AND id=?',id))continue;
   const allowed=Boolean(policy.generation===state.generation&&memoryHash(policy.binding)===memoryHash(data.binding()));
   data.sql.run('INSERT INTO mm_intakes VALUES($user,?,?,?,?,0,NULL,NULL,?,?)',id,material.id,material.revision,JSON.stringify({evaluationTime,generation:policy.generation,settings:policy.settings,binding:policy.binding,strategy,required}),new Date().toISOString(),allowed?'pending':'skipped');
   if(allowed){const task=this.execution.forUser(run.context).submitSync({kind:'memory.intake',operationId:'memory-intake:'+identity,input:{id}});data.sql.run('UPDATE mm_intakes SET task_id=? WHERE user_id=$user AND id=?',task.id,id);}
  }
 }
 private async execute(run:TaskRun){
  const {id}=inputSchema.parse(run.task.input),{data,row,receipt}=this.receipt(run.context,id);if(row.state==='complete')return {retained:true};
  const policy=receipt.settings.lifecycle.extraction,count=Number(data.sql.get("SELECT count(*) n FROM mm_intakes WHERE user_id=$user AND revoked=0 AND state='pending' AND json_remove(json,'$.evaluationTime')=json_remove(?,'$.evaluationTime')",row.json)!.n),due=Date.parse(String(row.created_at))+(policy.maxWaitHours??policy.intervalHours)*3600000;
  if(!row.job_id&&count<policy.minChanges&&Date.now()<due&&!data.sql.get('SELECT 1 FROM mm_binding_locks WHERE user_id=$user'))throw new ExecutionFailure('waiting','memory_window_pending',Math.min(due-Date.now(),60000),{executionStarted:false});
  const selected=row.job_id?data.sql.all('SELECT * FROM mm_intakes WHERE user_id=$user AND job_id=? ORDER BY created_at,id',row.job_id):data.sql.all("SELECT * FROM mm_intakes WHERE user_id=$user AND revoked=0 AND state='pending' AND job_id IS NULL AND json_remove(json,'$.evaluationTime')=json_remove(?,'$.evaluationTime') ORDER BY created_at,id LIMIT ?",row.json,policy.maxItems),jobId=String(row.job_id??id);
  const materials=selected.map(item=>({id:String(item.id),materialId:String(item.material_id),revision:String(item.revision),evaluationTime:intakeReceiptSchema.parse(JSON.parse(String(item.json))).evaluationTime}));
  run.grant.commit(()=>{for(const item of materials){this.receipt(run.context,item.id);data.sql.run('UPDATE mm_intakes SET job_id=? WHERE user_id=$user AND id=?',jobId,item.id);}});
  const result=await this.admit(run.context,jobId,materials,receipt);run.grant.assert();
  run.grant.commit(()=>{for(const item of materials){this.receipt(run.context,item.id);data.sql.run("UPDATE mm_intakes SET state='complete' WHERE user_id=$user AND id=?",item.id);}});return result;
 }
 async close(){for(const dispose of this.disposers.reverse())await dispose();}
}

/** Withdrawal is durable even if a source or recipe is later re-enabled. */
export function revokeCaptureIntakes(sql:PrivateSql,value:ReturnType<typeof memorySettingsSchema.parse>){for(const row of sql.all('SELECT capture_id,source_id,json FROM mm_capture_intakes WHERE user_id=$user AND revoked=0')){const policy=JSON.parse(String(row.json)),source=sql.get('SELECT json FROM pd_sources WHERE user_id=$user AND id=?',row.source_id),definition=source?JSON.parse(String(source.json)):undefined,refs=value.sourceRecipes[String(row.source_id)]??(definition&&isCaptureMemorySource(definition.id,definition.deviceId)?value.captureRecipes:definition?.kind==='lark-docs'?value.documentRecipes:value.recipes??[value.profile==='coding'?value.codingRecipe:value.recipe]),revokedRecipes=[...new Set([...(policy.revokedRecipes??[]),...policy.strategies.filter((strategy:IntakeReceipt['strategy'])=>!refs.some(ref=>ref.id===strategy.recipe.id&&ref.version===strategy.recipe.version)).map((strategy:IntakeReceipt['strategy'])=>memoryHash(strategy.recipe))])];sql.run('UPDATE mm_capture_intakes SET json=?,revoked=? WHERE user_id=$user AND capture_id=?',JSON.stringify({...policy,revokedRecipes}),Number(!value.automatic),row.capture_id);}}
