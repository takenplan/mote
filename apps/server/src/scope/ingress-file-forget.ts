import {z} from 'zod';
import type {PrivateSql} from './private-data-sql.js';
import {PrivateDataError,missing} from './private-data-sql.js';
import type {PrivateData} from './private-data.js';
import type {Originals,Original} from './originals.js';

export const forgottenFileSchema=z.object({source_id:z.string().min(1).max(128),external_id:z.string().min(1).max(1000),capture_id:z.string().uuid(),generation:z.number().int().positive().safe(),blocked:z.union([z.literal(0),z.literal(1)])}).strict();

/** Metadata-only incarnation proof used by M06's host validation without
 * reconstructing a live user context or a reusable original capability. */
export function fileOriginalGeneration(sql:PrivateSql,ref:string){
 const row=sql.get("SELECT COALESCE(f.generation,0) generation FROM ig_originals r JOIN pd_captures c ON c.user_id=r.user_id AND c.id=r.capture_id LEFT JOIN ig_file_forgets f ON f.user_id=c.user_id AND f.source_id=c.source_id AND f.external_id=c.external_id WHERE r.user_id=$user AND c.user_id=$user AND r.id=?",ref.slice(9));if(!row)throw missing();return Number(row.generation);
}

/** The original per-file forget/allow-again intent. Tombstones contain identity,
 * never content, and survive removal of every original/capture revision. */
export function fileForgetting(sql:PrivateSql,originals:Originals,data:()=>PrivateData,owner:()=>void,source:(id:string)=>unknown,retire:(refs:readonly string[])=>void){
 const state=(sourceId:string,externalId:string)=>sql.get('SELECT * FROM ig_file_forgets WHERE user_id=$user AND source_id=? AND external_id=?',sourceId,externalId);
 const allowed=(sourceId:string,item:{kind:string;externalId:string})=>{if(item.kind==='file'&&state(sourceId,item.externalId)?.blocked)throw new PrivateDataError('file_forgotten',410);};
 return {
  allowed,
  generation:(original:Original)=>{const capture=data().capture(original.captureId);return Number(capture.provenance?state(original.sourceId,capture.provenance.externalId)?.generation??0:0);},
  forget:(captureId:string)=>{
   owner();const removed=sql.transaction(()=>{
    const capture=data().capture(z.string().uuid().parse(captureId)),p=capture.provenance;if(capture.source!=='file'||!p)throw missing();source(p.sourceId);const previous=Number(state(p.sourceId,p.externalId)?.generation??0);if(previous>=Number.MAX_SAFE_INTEGER)throw new PrivateDataError('conflict',409);
    const rows=sql.all("SELECT c.id,r.id original_id FROM pd_captures c LEFT JOIN ig_originals r ON r.user_id=c.user_id AND r.capture_id=c.id WHERE c.user_id=$user AND c.source_id=? AND c.external_id=? AND json_extract(c.json,'$.source')='file'",p.sourceId,p.externalId),ids=rows.map(row=>String(row.id)),refs=rows.flatMap(row=>row.original_id?['original:'+row.original_id]:[]);
    retire(refs);sql.run('INSERT INTO ig_file_forgets VALUES($user,?,?,?,?,1) ON CONFLICT(user_id,source_id,external_id) DO UPDATE SET capture_id=excluded.capture_id,generation=excluded.generation,blocked=1',p.sourceId,p.externalId,captureId,previous+1);
    const uploads=sql.all("SELECT id FROM ig_uploads WHERE user_id=$user AND source_id=? AND json_extract(manifest,'$.item.externalId')=?",p.sourceId,p.externalId).map(row=>String(row.id));
    sql.run("DELETE FROM ig_uploads WHERE user_id=$user AND source_id=? AND json_extract(manifest,'$.item.externalId')=?",p.sourceId,p.externalId);
    sql.run("DELETE FROM ig_batches WHERE user_id=$user AND source_id=? AND EXISTS(SELECT 1 FROM json_each(ig_batches.receipt,'$.captures') c WHERE json_extract(c.value,'$.id') IN(SELECT value FROM json_each(?)))",p.sourceId,JSON.stringify(ids));
    for(const id of ids)data().deleteCapture(id);return {ids,refs,uploads};
   });
   // SQL removal is committed first. A held physical reader or an I/O failure
   // may postpone existing GC, never roll back metadata to now-missing bytes.
   let cleanup:'complete'|'pending'='complete';try{for(const id of removed.uploads)originals.cleanUpload(id);originals.gc();if(sql.get('SELECT id FROM ig_pins WHERE user_id=$user AND original_id IN(SELECT value FROM json_each(?)) LIMIT 1',JSON.stringify(removed.refs.map(ref=>ref.slice(9)))))cleanup='pending';}catch{cleanup='pending';}
   return {deleted:removed.ids.length,cleanup};
  },
  allowAgain:(captureId:string,raw:unknown)=>{
   owner();const input=z.object({sourceId:z.string().min(1).max(128),externalId:z.string().min(1).max(1000)}).strict().parse(raw);z.string().uuid().parse(captureId);source(input.sourceId);return sql.transaction(()=>{const row=state(input.sourceId,input.externalId);if(!row||row.capture_id!==captureId)throw missing();sql.run('UPDATE ig_file_forgets SET blocked=0 WHERE user_id=$user AND source_id=? AND external_id=?',input.sourceId,input.externalId);return {allowed:true};});
  },
 };
}
