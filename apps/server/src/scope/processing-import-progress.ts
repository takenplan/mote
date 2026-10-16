import type {ImportJob,ImportMemoryProgress} from '@mote/shared';
import type {MemoryHost} from './memory.js';
import type {PrivateSql} from './private-data-sql.js';
import type {TaskExecution} from './task-execution.js';
import {PrivateDataError} from './private-data-sql.js';
import {ScopeError} from './baseline.js';

type State=Exclude<keyof ImportMemoryProgress,'total'|'receipts'|'jobIds'>;
const modelWaiting=new Set(['model_snapshot_unavailable','model_authority_revoked','model_configuration_unavailable']);
const priority:State[]=['unavailable','failed','waitingForModel','running','pending','paused','cancelled','disabled','completed'];
/** Read-only projection of the existing M06/M08 receipt graph. A successful
 * import/Material is never treated as successful Memory or fresh permission. */
export function projectImportProgress(sql:PrivateSql,job:ImportJob,tasks:ReturnType<TaskExecution['forUser']>,memory:ReturnType<MemoryHost['forUser']>,processing:(ref:string)=>{indexed:boolean;current:boolean}){
 const ids=[...new Set([...job.captureIds,...(job.media??[]).flatMap(item=>item.captureId?[item.captureId]:[])])],states=new Map<string,State>(),jobs=new Set<string>();
 const progress:ImportMemoryProgress={total:ids.length,receipts:0,completed:0,pending:0,running:0,failed:0,waitingForModel:0,paused:0,cancelled:0,disabled:0,unavailable:0,jobIds:[]};
 for(const captureId of ids){
  const original=sql.get('SELECT c.id,s.json,h.capture_id FROM pd_captures c JOIN pd_sources s ON s.user_id=c.user_id AND s.id=c.source_id JOIN pd_source_heads h ON h.user_id=c.user_id AND h.source_id=c.source_id AND h.external_id=c.external_id WHERE c.user_id=$user AND s.user_id=$user AND h.user_id=$user AND c.id=?',captureId),receipt=sql.get('SELECT json,revoked FROM mm_capture_intakes WHERE user_id=$user AND capture_id=?',captureId),policy=receipt?JSON.parse(String(receipt.json)):undefined,selected=policy?.strategies??[],values:State[]=[];
  progress.receipts+=selected.length;
  if(!original||original.capture_id!==captureId||JSON.parse(String(original.json)).enabled===false)values.push('unavailable');
  else if(!receipt||receipt.revoked||!selected.length)values.push('disabled');
  else{
   const entries=sql.all('WITH RECURSIVE descendants(id,revision) AS(SELECT material_id,revision FROM pd_material_captures WHERE user_id=$user AND capture_id=? UNION SELECT p.material_id,p.revision FROM pd_material_inputs p JOIN descendants d ON p.input_material_id=d.id AND p.input_revision=d.revision WHERE p.user_id=$user) SELECT DISTINCT i.id,i.revoked,i.state,i.job_id FROM mm_intakes i JOIN descendants d ON d.id=i.material_id AND d.revision=i.revision JOIN pd_materials h ON h.user_id=i.user_id AND h.id=i.material_id AND h.revision=i.revision AND h.sequence>=h.min_visible_sequence WHERE i.user_id=$user AND h.user_id=$user',captureId);
   for(const entry of entries){
    if(entry.revoked||entry.state==='skipped'){values.push('disabled');continue;}if(!entry.job_id){values.push('pending');continue;}
    const id=String(entry.job_id);jobs.add(id);const current=memory.job(id),work=Object.values(current.tasks);
    if(!current.current)values.push('unavailable');else if(current.state==='committed')values.push('completed');else if(current.state==='cancelled')values.push('cancelled');else if(current.state==='paused')values.push('paused');else if(work.some(task=>task.state==='running'))values.push('running');else if(work.some(task=>task.state==='blocked'&&modelWaiting.has(task.failure?.code??'')))values.push('waitingForModel');else if(work.some(task=>['failed','stale','blocked'].includes(task.state)))values.push('failed');else values.push('pending');
   }
   // Unadmitted recipe receipts remain pending; successful siblings cannot
   // make the original appear complete while another selected recipe waits.
   if(entries.length<selected.length||!entries.length)values.push('pending');
  }
  const state=priority.find(state=>values.includes(state))??'unavailable';states.set(captureId,state);progress[state]++;
 }
 progress.jobIds=[...jobs];
 const media=job.media?.map(item=>{
  if(!item.captureId)return item;const row=sql.get('SELECT id FROM ig_originals WHERE user_id=$user AND capture_id=?',item.captureId);if(!row)return {...item,processing:{state:'blocked',stage:'intake',error:'original_missing'},searchable:false};
  const ref='original:'+row.id;let status:{indexed:boolean;current:boolean};try{status=processing(ref);}catch(error){if(!(error instanceof PrivateDataError||error instanceof ScopeError))throw error;return {...item,processing:{state:'blocked',stage:'intake',error:'original_unavailable'},searchable:false,memory:{state:'unavailable',jobIds:[]}};}
  const latest=sql.get('SELECT a.task_id FROM mp_admissions a JOIN execution_steps e ON e.user_id=a.user_id AND e.id=a.task_id WHERE a.user_id=$user AND e.user_id=$user AND a.original_id=? ORDER BY e.updated_at DESC,e.id LIMIT 1',String(row.id)),task=latest?tasks.get(String(latest.task_id)):undefined,state=states.get(item.captureId),jobIds=sql.all('WITH RECURSIVE descendants(id,revision) AS(SELECT material_id,revision FROM pd_material_captures WHERE user_id=$user AND capture_id=? UNION SELECT p.material_id,p.revision FROM pd_material_inputs p JOIN descendants d ON p.input_material_id=d.id AND p.input_revision=d.revision WHERE p.user_id=$user) SELECT DISTINCT i.job_id FROM mm_intakes i JOIN descendants d ON d.id=i.material_id AND d.revision=i.revision JOIN pd_materials h ON h.user_id=i.user_id AND h.id=i.material_id AND h.revision=i.revision AND h.sequence>=h.min_visible_sequence WHERE i.user_id=$user AND h.user_id=$user AND i.job_id IS NOT NULL',item.captureId).map(row=>String(row.job_id));
  return {...item,processing:{state:!status.current?'blocked':task?.state??'blocked',stage:task?.kind??'intake',...(task?.failure?{error:task.failure.code}:{})},searchable:status.current&&status.indexed,memory:{state:state==='waitingForModel'?'waiting_for_model':state==='pending'?'waiting':state??'unavailable',jobIds}};
 });
 return {...(media?{media}:{}),...(ids.length?{memoryProgress:progress}:{})};
}
