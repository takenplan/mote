import {z} from 'zod';
import type {UserContext} from './context.js';
import type {TaskExecution} from './task-execution.js';
import {PrivateCursor} from './private-data-sql.js';
import type {ScopedMemoryData,MemoryRow} from './memory-data.js';
import {intakeReceiptSchema} from './memory-intake.js';
import {integrationWindowSchema} from './memory-integration.js';

/** Read only the existing per-owner receipts and M05 facts. No synthetic global
 * lifecycle, model/provider call, admission, cursor write or scheduler. */
export function memoryObservationPage(data:ScopedMemoryData,context:UserContext,execution:TaskExecution,key:string,raw:unknown){
 const input=z.object({limit:z.coerce.number().int().min(1).max(100).default(20),cursor:z.string().max(8192).optional()}).strict().parse(raw),identity={collection:'memory-window-observations',limit:input.limit},cursor=new PrivateCursor(key,context.deploymentId,context.userId),position=input.cursor?z.object({at:z.string(),kind:z.enum(['extraction','consolidation']),id:z.string().uuid()}).strict().parse(cursor.decodeCompact(input.cursor,identity)):undefined;
 const rows=data.sql.all(`SELECT * FROM(SELECT 'extraction' kind,id,json,created_at,task_id,job_id,state,revoked FROM mm_intakes WHERE user_id=$user UNION ALL SELECT 'consolidation' kind,id,json,created_at,task_id,job_id,state,revoked FROM mm_integration_windows WHERE user_id=$user) ${position?'WHERE (created_at,kind,id)<(?,?,?)':''} ORDER BY created_at DESC,kind DESC,id DESC LIMIT ?`,...(position?[position.at,position.kind,position.id]:[]),input.limit+1),page=rows.slice(0,input.limit),last=page.at(-1);
 return {scope:'account' as const,items:page.map(row=>{
  const kind=String(row.kind) as 'extraction'|'consolidation',createdAt=String(row.created_at);let pendingChanges:number,dueAt:number;
  if(kind==='extraction'){
   const receipt=intakeReceiptSchema.parse(JSON.parse(String(row.json))),policy=receipt.settings.lifecycle.extraction;
   pendingChanges=row.state==='pending'?Number(data.sql.get("SELECT count(*) n FROM mm_intakes WHERE user_id=$user AND revoked=0 AND state='pending' AND json=?",row.json)!.n):0;dueAt=Date.parse(createdAt)+(policy.maxWaitHours??policy.intervalHours)*3600000;
  }else{
   const window=integrationWindowSchema.parse(JSON.parse(String(row.json))),policy=window.settings.lifecycle.consolidation;
   const candidates=data.sql.all("SELECT r.* FROM mm_records r WHERE r.user_id=$user AND json_extract(r.json,'$.status')='published' AND json_extract(r.json,'$.tier')='episode' AND json_extract(r.json,'$.domain')=? AND json_extract(r.json,'$.supersededBy') IS NULL AND NOT EXISTS(SELECT 1 FROM mm_integrated_versions v WHERE v.user_id=$user AND v.id=r.id AND v.version=r.version AND v.fingerprint=r.fingerprint) ORDER BY r.created_at,r.id",window.settings.profile);
   pendingChanges=row.state==='complete'?0:window.selection?.length??candidates.filter(item=>{try{data.assertCurrentRecord(item as MemoryRow);return true;}catch{return false;}}).length;dueAt=Date.parse(createdAt)+(policy.maxWaitHours??policy.intervalHours)*3600000;
  }
  return {id:String(row.id),kind,state:String(row.state),revoked:Boolean(row.revoked),createdAt,dueAt:new Date(dueAt).toISOString(),pendingChanges,jobId:row.job_id?String(row.job_id):null,task:row.task_id?execution.forUser(context).observe(String(row.task_id)):null};
 }),nextCursor:rows.length>input.limit&&last?cursor.encodeCompact(identity,{at:String(last.created_at),kind:String(last.kind),id:String(last.id)}):null};
}
