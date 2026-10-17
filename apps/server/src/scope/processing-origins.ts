import type {DatabaseSync} from 'node:sqlite';
import {sourceItemSchema} from '@mote/shared';
import type {ExecutionEngine} from '../execution-engine.js';
import {connectorHash,existingConnectorReceipt} from './connector-vault.js';

export type ProcessingOrigin='automatic'|'owner'|'plugin'|'unknown';
type Task={task_id:string;user_id:string;input:string};
export const RECORDING_AUTOMATIC_RETIRED='recording_backup_automatic_processing_retired';
/** Host-only admission provenance. Original metadata and caller-selected
 * operation ids cannot grant owner intent or prove a historical automatic job. */
export class ProcessingOrigins {
 constructor(private db:DatabaseSync){}
 record(user:string,task:string,original:string,origin:ProcessingOrigin,root=task){
  this.db.prepare(`INSERT INTO mp_admission_origins VALUES(?,?,?,?,?) ON CONFLICT(user_id,task_id)
   DO UPDATE SET origin=CASE WHEN excluded.origin='owner' AND mp_admission_origins.origin<>'plugin' THEN 'owner' ELSE mp_admission_origins.origin END`).run(user,task,original.replace(/^original:/,''),origin,root);
 }
 private task(user:string,id:string){return this.db.prepare('SELECT task_id,user_id,input FROM user_tasks WHERE user_id=? AND task_id=?').get(user,id) as Task|undefined;}
 root(user:string,task:string):{id:string;origin:ProcessingOrigin}|undefined {
  const seen=new Set<string>();let id=task;
  while(!seen.has(id)){
   seen.add(id);const known=this.db.prepare('SELECT origin,root_task_id FROM mp_admission_origins WHERE user_id=? AND task_id=?').get(user,id);
   if(known){const root=this.db.prepare('SELECT origin FROM mp_admission_origins WHERE user_id=? AND task_id=?').get(user,known.root_task_id);return {id:String(known.root_task_id),origin:String(root?.origin??known.origin) as ProcessingOrigin};}
   const row=this.task(user,id);if(!row)return;const input=JSON.parse(row.input);
   if(input.plugin)return {id,origin:'plugin'};
   const parent=typeof input.parentTaskId==='string'?input.parentTaskId:typeof input.intentTaskId==='string'?input.intentTaskId:typeof input.intentId==='string'?input.intentId:undefined;
   if(!parent)return {id,origin:'unknown'};id=parent;
  }
 }
 inherit(user:string,child:string,original:string,parent:string){const root=this.root(user,parent);if(root)this.record(user,child,original,root.origin,root.id);}
 origin(user:string,task:string):ProcessingOrigin|undefined{return this.root(user,task)?.origin;}
 forbidden(user:string,task:string,original:string){return this.origin(user,task)==='automatic'&&this.db.prepare("SELECT 1 FROM mp_original_formats WHERE user_id=? AND original_id=? AND format='recording-audio-backup'").get(user,original.replace(/^original:/,''))!==undefined;}
 /** Only the trusted owner retry route invokes this. Internal retries do not
  * promote a background intent; issued/unknown call facts are never cleared. */
 ownerRetry(user:string,task:string,engine:ExecutionEngine){
  const root=this.root(user,task);if(!root||root.origin==='plugin')return;
  const row=this.task(user,root.id),input=row?JSON.parse(row.input):undefined;if(!input?.originalRef)return;
  this.record(user,root.id,input.originalRef,'owner');this.db.prepare("UPDATE mp_admission_origins SET origin='owner' WHERE user_id=? AND root_task_id=? AND origin<>'plugin'").run(user,root.id);
  // A retired coordinator reuses its exact child identities. Restore only its
  // own policy-retired subtree; ordinary cancellation and unknown calls stay.
  for(const row of this.db.prepare(`SELECT e.id FROM execution_steps e JOIN user_tasks u ON u.user_id=e.user_id AND u.task_id=e.id
   WHERE e.user_id=? AND e.state IN('cancelled','blocked') AND e.error=? AND u.external_state NOT IN('issued','unknown')
   AND NOT EXISTS(SELECT 1 FROM task_external_calls c WHERE c.user_id=u.user_id AND c.task_id=u.task_id AND c.state IN('issued','unknown'))`).all(user,RECORDING_AUTOMATIC_RETIRED))if(this.root(user,String(row.id))?.id===root.id)engine.retry(String(row.id));
 }
 /** A successful work checkpoint alone does not identify the current capture:
  * owner uploads can reuse external ids. Require the authenticated host head,
  * exact canonical item/capture and original hash as well as connector ledger. */
 private repairFormats(directory:string,deploymentId:string){
  const db=this.db,tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>String(row.name)));
  if(!['connector_connections','connector_sources','connector_ledger','connector_secrets'].every(table=>tables.has(table)))return;
  const rows=db.prepare(`SELECT DISTINCT o.user_id,o.id,o.capture_id,o.hash,c.json,l.json AS work,c.external_id,s.source_id,s.local_id,co.id AS connection_id,co.storage_generation,co.settings
   FROM ig_originals o JOIN pd_captures c ON c.user_id=o.user_id AND c.id=o.capture_id
   JOIN mp_original_formats f ON f.user_id=o.user_id AND f.original_id=o.id AND f.format='file'
   JOIN connector_sources s ON s.user_id=o.user_id AND s.source_id=o.source_id
   JOIN connector_connections co ON co.user_id=s.user_id AND co.id=s.instance_id
   JOIN connector_ledger l ON l.user_id=s.user_id AND l.instance_id=s.instance_id AND l.key='work:'||substr(c.external_id,1,length(c.external_id)-6)
   WHERE o.mime LIKE 'audio/%' AND substr(c.external_id,-6)=':audio'`).all();
  const checked=new Set<string>(),namespaces=new Map<string,string[]>();
  for(const row of rows){
   const key=JSON.stringify([row.user_id,row.id]);if(checked.has(key))continue;
   const connection=JSON.parse(String(row.settings)),work=JSON.parse(String(row.work)),capture=JSON.parse(String(row.json)),provenance=capture.provenance,provider=connection.provider;
   if(!['feishu-recordings','dingtalk-recordings'].includes(provider)||work.id+':audio'!==row.external_id||!(work.media===true||work.stages?.media?.state==='succeeded')||capture.source!=='file'||provenance?.sourceId!==row.source_id||provenance?.externalId!==row.external_id||provenance?.layer!=='original'||!String(row.local_id).startsWith(provider+'-'))continue;
   const {sourceId:_sourceId,...rest}=provenance,item=sourceItemSchema.safeParse({...rest,observedAt:capture.capturedAt,title:capture.windowTitle,text:capture.ocrText,kind:capture.source});if(!item.success)continue;
   const namespaceKey=JSON.stringify([row.user_id,row.connection_id,row.storage_generation]);let instances=namespaces.get(namespaceKey);
   if(!instances){const prefix=row.connection_id+':'+row.storage_generation+':';instances=db.prepare('SELECT DISTINCT instance_id FROM connector_secrets WHERE user_id=? AND substr(instance_id,1,?)=?').all(row.user_id,prefix.length,prefix).map(value=>String(value.instance_id)).filter(value=>/^\d+$/.test(value.slice(prefix.length)));namespaces.set(namespaceKey,instances);}
   const name='head:'+connectorHash([row.local_id,row.external_id]);
   if(!instances.some(instance=>{const head=existingConnectorReceipt<{captureId:string;item:unknown}>(db,directory,deploymentId,String(row.user_id),instance,name),parsed=head&&sourceItemSchema.safeParse(head.item);return head?.captureId===row.capture_id&&parsed?.success&&connectorHash(parsed.data)===connectorHash(item.data)&&parsed.data.document?.originalMetadata?.bodyHash===row.hash;}))continue;
   db.prepare("UPDATE mp_original_formats SET format='recording-audio-backup' WHERE user_id=? AND original_id=? AND format='file'").run(row.user_id,row.id);checked.add(key);
  }
 }
 /** Run after domains install, before the executor starts. Legacy schemas did
  * not retain initiation purpose: even exact intake request keys were owner
  * selectable. Such roots remain unknown instead of being fabricated as auto. */
 reconcile(engine:ExecutionEngine,directory:string,deploymentId:string){
  const db=this.db;db.exec('BEGIN IMMEDIATE');
  try{
   this.repairFormats(directory,deploymentId);
   const tasks=db.prepare(`SELECT u.task_id,u.user_id,u.input FROM user_tasks u JOIN execution_steps e ON e.id=u.task_id AND e.user_id=u.user_id
    JOIN mp_original_formats f ON f.user_id=u.user_id AND 'original:'||f.original_id=json_extract(u.input,'$.originalRef') AND f.format='recording-audio-backup'
    WHERE e.kind LIKE 'processing.%'`).all() as Task[];
   for(const task of tasks){const input=JSON.parse(task.input),root=this.root(task.user_id,task.task_id);if(root)this.record(task.user_id,task.task_id,input.originalRef,root.origin,root.id);}
   const retire:string[]=[];
   for(const task of tasks){const input=JSON.parse(task.input),step=engine.get(task.task_id);if(!step||!['waiting','running','blocked'].includes(step.state)||!this.forbidden(task.user_id,task.task_id,input.originalRef))continue;engine.cancel(task.task_id,false,RECORDING_AUTOMATIC_RETIRED);retire.push(task.task_id);}
   db.exec('COMMIT');for(const id of retire)engine.abortLocal(id);
  }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
 }
}
