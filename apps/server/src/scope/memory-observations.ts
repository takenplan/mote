import {z} from 'zod';
import type {UserContext} from './context.js';
import type {TaskExecution} from './task-execution.js';
import {PrivateCursor} from './private-data-sql.js';
import type {ScopedMemoryData} from './memory-data.js';
import {intakeReceiptSchema} from './memory-intake.js';
import {integrationCandidates,integrationDueAt,integrationWindowSchema} from './memory-integration.js';

export type MaterialIntakeProgress={state:string;count:number;error?:string};
type ObservedMemoryJob={id:string;current:boolean;state:string;tasks:Record<string,{state:string;failure?:{code?:string}|null}>};
/** A reserved intake job identity is not proof that the Memory job exists.
 * Consumers read real intake/task facts until actual job admission succeeds. */
export function materialIntakeProgress(data:ScopedMemoryData,context:UserContext,execution:TaskExecution,materialId:string,revision:string,job:(id:string)=>ObservedMemoryJob):MaterialIntakeProgress[]{
 return data.sql.all('SELECT state,task_id,job_id FROM mm_intakes WHERE user_id=$user AND material_id=? AND revision=? AND revoked=0',materialId,revision).map(receipt=>{
  if(!receipt.job_id||!data.sql.get('SELECT 1 FROM mm_jobs WHERE user_id=$user AND id=?',receipt.job_id)){
   const task=receipt.task_id?execution.forUser(context).observe(String(receipt.task_id)):undefined;
   return {state:receipt.state!=='pending'?String(receipt.state):task&&task.state!=='succeeded'?task.state:'waiting',count:0,error:receipt.state==='pending'?task?.reason:undefined};
  }
  const current=job(String(receipt.job_id)),steps=Object.values(current.tasks),failure=steps.find(task=>['blocked','failed','cancelled','stale'].includes(task.state));
  const state=!current.current?'stale':current.state==='paused'?'paused':failure?.state??(current.state==='committed'?'completed':steps.some(task=>task.state==='running')?'running':current.state==='awaiting_context'?'waiting_for_input':'waiting');
  const batches=data.sql.all('SELECT prepared FROM mm_job_batches WHERE user_id=$user AND job_id=?',current.id),count=state==='completed'?batches.reduce((total,batch)=>total+(batch.prepared?JSON.parse(String(batch.prepared)).items?.length??0:0),0):0;
  return {state,count,error:failure?.failure?.code};
 });
}

/** Read only the existing per-owner receipts and M05 facts. No synthetic global
 * lifecycle, model/provider call, admission, cursor write or scheduler. */
export function memoryObservationPage(data:ScopedMemoryData,context:UserContext,execution:TaskExecution,key:string,raw:unknown){
 const input=z.object({limit:z.coerce.number().int().min(1).max(100).default(20),cursor:z.string().max(8192).optional()}).strict().parse(raw),identity={collection:'memory-window-observations',limit:input.limit},cursor=new PrivateCursor(key,context.deploymentId,context.userId),position=input.cursor?z.object({at:z.string(),kind:z.enum(['extraction','consolidation']),id:z.string().uuid()}).strict().parse(cursor.decodeCompact(input.cursor,identity)):undefined;
 const rows=data.sql.all(`SELECT * FROM(SELECT 'extraction' kind,id,json,created_at,task_id,job_id,state,revoked FROM mm_intakes WHERE user_id=$user UNION ALL SELECT 'consolidation' kind,id,json,created_at,task_id,job_id,state,revoked FROM mm_integration_windows WHERE user_id=$user) ${position?'WHERE (created_at,kind,id)<(?,?,?)':''} ORDER BY created_at DESC,kind DESC,id DESC LIMIT ?`,...(position?[position.at,position.kind,position.id]:[]),input.limit+1),page=rows.slice(0,input.limit),last=page.at(-1);
 return {scope:'account' as const,items:page.map(row=>{
  const kind=String(row.kind) as 'extraction'|'consolidation',createdAt=String(row.created_at);let pendingChanges:number,dueAt:number;
  if(kind==='extraction'){
   const receipt=intakeReceiptSchema.parse(JSON.parse(String(row.json)));
   pendingChanges=row.state==='pending'?Number(data.sql.get("SELECT count(*) n FROM mm_intakes WHERE user_id=$user AND revoked=0 AND state='pending' AND json=?",row.json)!.n):0;dueAt=Date.parse(createdAt);
  }else{
   const window=integrationWindowSchema.parse(JSON.parse(String(row.json)));
   pendingChanges=row.state==='complete'?0:window.selection?.length??integrationCandidates(data,window,String(row.id)).length;dueAt=integrationDueAt(createdAt,window);
  }
  return {id:String(row.id),kind,state:String(row.state),...(kind==='extraction'&&intakeReceiptSchema.parse(JSON.parse(String(row.json))).limitation?{limitation:intakeReceiptSchema.parse(JSON.parse(String(row.json))).limitation}:{}),revoked:Boolean(row.revoked),createdAt,dueAt:new Date(dueAt).toISOString(),pendingChanges,jobId:row.job_id?String(row.job_id):null,task:row.task_id?execution.forUser(context).observe(String(row.task_id)):null};
 }),nextCursor:rows.length>input.limit&&last?cursor.encodeCompact(identity,{at:String(last.created_at),kind:String(last.kind),id:String(last.id)}):null};
}
