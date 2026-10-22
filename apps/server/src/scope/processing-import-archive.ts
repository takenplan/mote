import {importSourceIdentity} from './import-identity.js';
import {z} from 'zod';
import {importStatusSchema,importReviewDecisionSchema} from '@mote/shared';
import {archivedImportFileSchema} from '../archive-contract.js';
import {importRecordSchema} from '../import-record.js';
import {PrivateSql,PrivateDataError} from './private-data-sql.js';
import {identityHash} from './originals.js';

const hash=z.string().regex(/^[a-f0-9]{64}$/),count=z.number().int().nonnegative(),at=z.string().datetime({offset:true});
const job=z.object({id:z.string().uuid(),name:z.string().min(1).max(200),instruction:z.string().max(12000),sourceId:z.string().regex(/^import\.[a-f0-9]{32}$/),sourcePackId:z.string().max(128).optional(),imageProfileId:z.string().max(100).optional(),status:importStatusSchema,processingStatus:z.enum(['archived','analyzing','preview_ready','saving','saved','blocked']),createdAt:at,updatedAt:at,files:z.array(archivedImportFileSchema).min(1).max(4000),summary:z.string().max(20000),warnings:z.array(z.string().max(2000)).max(200),archive:z.object({files:count,bytes:count,expandedFiles:count}).strict(),progress:z.object({total:count,processed:count,imported:count,duplicates:count}).strict(),preview:z.object({count,samples:z.array(z.object({title:z.string().max(2000),text:z.string().max(2000),kind:z.string().max(100),attachmentCount:count}).strict()).max(12)}).strict().optional(),dispositions:z.object({counts:z.object({parsed:count,attachment:count,container:count,excluded:count,unsupported:count,processing:count.optional()}).strict(),items:z.array(z.object({fileId:z.string().uuid(),path:z.string().max(1000),status:z.enum(['parsed','attachment','container','excluded','unsupported','processing']),reason:z.string().max(2000)}).strict()).max(4000)}).strict().optional(),reviewDecision:importReviewDecisionSchema.optional(),reviewGate:z.object({decision:z.enum(['automatic','confirmation']),reason:z.string().max(2000)}).strict().optional(),error:z.string().max(2000).optional(),media:z.array(z.object({fileId:z.string().uuid(),format:z.object({id:z.string().max(128),version:z.string().max(64),mimeType:z.string().max(200),reason:z.string().max(2000),excluded:z.boolean().optional()}).strict(),captureId:z.string().uuid().optional()}).strict()).max(4000).optional(),captureIds:z.array(z.string().uuid()).max(10000),memoryJobId:z.string().max(256).optional()}).strict();
const snapshot=z.array(z.object({fingerprint:hash,generation:count,processing:z.enum(['automatic','preview']),job,manifest:hash.optional(),sourcePackRevision:hash.optional(),containers:z.record(z.object({id:z.string().max(128),version:z.string().max(64),expanded:z.boolean()}).strict()).optional(),sourceFileIds:z.array(z.string().uuid()).min(1).max(4000).optional(),excludedFiles:z.array(z.object({fileId:z.string().uuid(),reason:z.string().max(2000)}).strict()).max(4000).optional(),records:z.array(z.string().max(200000)).max(10000)}).strict()).max(10000);
const invalid=()=>new PrivateDataError('invalid_data');
/** Portable journal data contains no task IDs, confirmation or authority epoch.
 * Restoring a preview requires new owner preparation/confirmation. */
export function importJobArchive(sql:PrivateSql){return {
 export:()=>sql.all("SELECT fingerprint,json FROM mp_import_jobs WHERE user_id=$user AND coalesce(json_extract(json,'$.deleted'),0)=0 ORDER BY id").map(row=>{
  const {processing,generation,authorizationEpoch,manifest,confirmed,prepareTask,commitTask,recordsProcessed,sourcePackRevision,excludedFiles,sourceFileIds,containers,...value}=JSON.parse(String(row.json));
  return {fingerprint:String(row.fingerprint),generation,processing,job:job.parse(value),...(manifest?{manifest}:{}),...(sourcePackRevision?{sourcePackRevision}:{}),...(sourceFileIds?{sourceFileIds}:{}),...(containers?{containers}:{}),...(excludedFiles?{excludedFiles}:{}),records:sql.all('SELECT json FROM mp_import_records WHERE user_id=$user AND job_id=? AND generation=? ORDER BY position',value.id,generation).map(row=>String(row.json))};
 }),
 restore:(raw:unknown,merge:boolean)=>{
  const entries=snapshot.parse(raw??[]);if(new Set(entries.map(entry=>entry.job.id)).size!==entries.length)throw invalid();
  for(const entry of entries){
   if(entry.records.reduce((n,line)=>n+Buffer.byteLength(line),0)>32*1024*1024)throw invalid();
   for(const file of entry.job.files){const parent=sql.get('SELECT hash,json FROM ig_archive_files WHERE user_id=$user AND id=?',file.id);if(!parent||parent.hash!==file.hash||JSON.stringify(archivedImportFileSchema.parse(JSON.parse(String(parent.json))))!==JSON.stringify(file))throw invalid();}
   if(entry.job.sourceId!==importSourceIdentity(entry.job.files.filter(file=>!entry.sourceFileIds||entry.sourceFileIds.includes(file.id)),entry.job.id))throw invalid();
   if(entry.sourceFileIds&&(new Set(entry.sourceFileIds).size!==entry.sourceFileIds.length||entry.sourceFileIds.some(id=>!entry.job.files.some(file=>file.id===id))))throw invalid();
   if(Object.keys(entry.containers??{}).some(id=>!entry.job.files.some(file=>file.id===id)))throw invalid();
   if(entry.job.media?.some(item=>!entry.job.files.some(file=>file.id===item.fileId))||entry.excludedFiles?.some(item=>!entry.job.files.some(file=>file.id===item.fileId)))throw invalid();
   const records=entry.records.map(line=>importRecordSchema.parse(JSON.parse(line)));if(entry.manifest&&identityHash(records)!==entry.manifest)throw invalid();
   for(const record of records)if([...record.evidencePaths,...record.attachments].some(id=>!entry.job.files.some(file=>file.id===id)))throw invalid();
   if(entry.job.progress.processed>entry.job.progress.total||entry.job.progress.imported+entry.job.progress.duplicates!==entry.job.progress.processed||entry.job.preview&&entry.job.preview.count!==entry.job.progress.total)throw invalid();
   if(entry.job.dispositions?.items.some(item=>!entry.job.files.some(file=>file.id===item.fileId&&file.relativePath===item.path)))throw invalid();
   const prior=sql.get('SELECT fingerprint,json FROM mp_import_jobs WHERE user_id=$user AND id=?',entry.job.id);if(prior&&(JSON.parse(String(prior.json)).deleted||!merge||prior.fingerprint!==entry.fingerprint))throw new PrivateDataError('conflict',409);
  }
  for(const entry of entries){
   if(sql.get('SELECT id FROM mp_import_jobs WHERE user_id=$user AND id=?',entry.job.id))continue;
   const completed=entry.job.status==='completed',value={...entry.job,processing:entry.processing,generation:entry.generation+1,authorizationEpoch:-1,...(entry.sourcePackRevision?{sourcePackRevision:entry.sourcePackRevision}:{}),...(entry.containers?{containers:entry.containers}:{}),sourceFileIds:entry.sourceFileIds??entry.job.files.map(file=>file.id),...(entry.excludedFiles?{excludedFiles:entry.excludedFiles}:{}),recordsProcessed:entry.job.progress.processed-(entry.job.media?.filter(item=>item.captureId).length??0),...(completed?{manifest:entry.manifest}:{status:'needs_configuration',processingStatus:'blocked',error:'restored_preview_required'})};
   sql.run('INSERT INTO mp_import_jobs VALUES($user,?,?,?)',entry.job.id,entry.fingerprint,JSON.stringify(value));for(const file of entry.job.files)sql.run('INSERT INTO mp_import_files VALUES($user,?,?)',entry.job.id,file.id);
   if(completed)for(const [position,json] of entry.records.entries())sql.run('INSERT INTO mp_import_records VALUES($user,?,?,?,?)',entry.job.id,value.generation,position,json);
  }
 },
};}
