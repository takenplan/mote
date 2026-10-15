import {createHash,randomUUID} from 'node:crypto';
import {unknownAttributionContext,type QueryResult,type CaptureRecord} from '@mote/shared';
import {z} from 'zod';
import type {QueryInput} from '@mote/agent';
import {reviewMemoryDeletionCandidates} from '../memory-deletion-review.js';
import {memorySchema,type Memory} from '../memory-schema.js';
import {memoryBodyDigest,memoryProviderKey,withMemoryHostState} from '../memory-provider-contract.js';
import {validateMemoryExtraction,memoryEvidenceFingerprint,type MemoryRecord,type MemoryExtractOptions} from '../memory-contract.js';
import {PrivateSql,PrivateCursor,PrivateDataError,missing} from './private-data-sql.js';
import type {PrivateData} from './private-data.js';
import {materialDraftSchema,type MaterialDraft} from './material-model.js';
import {defaultMemorySettings,memoryBindingSchema,type ScopedMemoryBinding,type ScopedMemoryTask} from './memory-schema.js';

export const memoryHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid=(value:unknown)=>{const hash=memoryHash(value);return hash.slice(0,8)+'-'+hash.slice(8,12)+'-5'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);};
export type MemoryState={deleted:number;generation:number;revision:number;desired:number;settings:string;binding:string};
export type MemoryRow={id:string;version:number;fingerprint:string;body_digest:string;binding:string;json:string;created_at:string};
const pageSchema=z.object({query:z.string().trim().min(1).max(500).optional(),cursor:z.string().max(8000).optional(),limit:z.coerce.number().int().min(1).max(100).default(30),includeHistory:z.boolean().default(false)}).strict();

/** Private SQL never escapes this domain. Callers receive immutable values and
 * exact-current original reads, not a user selector or a database handle. */
export class ScopedMemoryData {
 constructor(readonly sql:PrivateSql,readonly privateData:PrivateData,private readonly cursor:PrivateCursor){}
 state():MemoryState{
  this.sql.run('INSERT OR IGNORE INTO mm_state VALUES($user,0,0,1,1,?,?)',JSON.stringify(defaultMemorySettings()),JSON.stringify({kind:'builtin',revision:1}));
  const state=this.sql.get('SELECT * FROM mm_state WHERE user_id=$user') as MemoryState;
  if(state.deleted)throw new PrivateDataError('scope_unavailable',503);return state;
 }
 binding():ScopedMemoryBinding{return memoryBindingSchema.parse(JSON.parse(this.state().binding));}
 deletionSnapshot(){return memoryHash(this.sql.all('SELECT id,json FROM mm_deletions WHERE user_id=$user ORDER BY id'));}
 materialEvidence(materialId:string,revision?:string,sourceIds?:readonly string[]):MemoryRecord[]{
  this.state();const material=this.privateData.material(materialId,revision),current=this.privateData.material(materialId);
  if(material.revision!==current.revision)throw new PrivateDataError('conflict',409);
  if(sourceIds){const sources=this.sql.all('SELECT source_id FROM pd_material_sources WHERE user_id=$user AND material_id=? AND revision=?',material.id,material.revision);if(!sources.length||sources.some(row=>!sourceIds.includes(String(row.source_id))))throw missing();}
  const row=this.sql.get('SELECT json FROM pd_material_versions WHERE user_id=$user AND material_id=? AND revision=?',material.id,material.revision)!;
  const draft=materialDraftSchema.parse(JSON.parse(String(row.json)));
  if(draft.coverage.state!=='complete'||draft.artifacts?.some(item=>item.state!=='ready'))throw new PrivateDataError('conflict',409);
  return this.sql.transaction(()=>draft.blocks.flatMap(block=>{
   if(block.kind!=='text'||!block.text)return [];
   const id=uuid([this.sql.userId,material.id,material.revision,block.id]),at=block.evidenceContext?.observedAt??draft.origin.firstAt??material.createdAt;
   const coding=['claude','codex','kimi'].includes(draft.origin.provider??'')&&draft.origin.sessionId&&draft.origin.projectKey?{version:1 as const,provider:draft.origin.provider as 'claude'|'codex'|'kimi',sessionId:draft.origin.sessionId,projectKey:draft.origin.projectKey,projectName:draft.origin.projectName,projectIdentity:draft.origin.projectIdentity,repositoryKey:draft.origin.repositoryKey,branch:draft.origin.branch,eventId:block.id,role:'transcript' as const,part:0,parts:1}:undefined;
   const record:CaptureRecord={id,blobHash:null,imageMime:null,deviceId:draft.origin.deviceId??draft.origin.sourceId,deviceName:'Material',platform:'import',capturedAt:at,receivedAt:material.createdAt,durationMs:0,source:'message',appId:'mote.material',appName:draft.title,windowTitle:draft.title,ocrText:block.text,indexingStatus:'indexed',privacy:{excluded:false,redacted:false,mode:'none'},attributionContext:block.evidenceContext?.attributionContext??draft.attributionContext??unknownAttributionContext(),provenance:{sourceId:draft.origin.sourceId,externalId:material.id,revision:material.revision,layer:'snapshot',deleted:false,uri:material.ref+'#'+block.id,document:{...block.evidenceContext?.document,...(coding?{coding}:{})}}};
   const hash=memoryEvidenceFingerprint(record),prior=this.sql.get('SELECT hash,json FROM mm_evidence WHERE user_id=$user AND id=?',id);
   if(prior&&(prior.hash!==hash||prior.json!==JSON.stringify(record)))throw new PrivateDataError('conflict',409);
   this.sql.run('INSERT OR IGNORE INTO mm_evidence VALUES($user,?,?,?,?,?,?)',id,material.id,material.revision,block.id,hash,JSON.stringify(record));return [record];
  }));
 }
 evidence(ids:readonly string[]):MemoryRecord[]{
  this.state();return [...new Set(ids)].map(id=>{
   const row=this.sql.get('SELECT * FROM mm_evidence WHERE user_id=$user AND id=?',id);if(!row)throw missing();
   const material=this.privateData.material(String(row.material_id));if(material.revision!==row.material_revision)throw new PrivateDataError('conflict',409);
   const record=JSON.parse(String(row.json)) as MemoryRecord;if(memoryEvidenceFingerprint(record)!==row.hash)throw new PrivateDataError('invalid_data');return record;
  });
 }
 assertInputs(input:ScopedMemoryTask){
  const state=this.state();if(state.generation!==input.generation||memoryHash(this.binding())!==memoryHash(input.binding)||input.deletionSnapshot!==this.deletionSnapshot())throw new PrivateDataError('conflict',409);
  const evidence=this.evidence(input.inputs.map(pin=>pin.id));for(const pin of input.inputs)if(memoryEvidenceFingerprint(evidence.find(item=>item.id===pin.id)!)!==pin.hash)throw new PrivateDataError('conflict',409);
  for(const pin of input.related){const row=this.row(pin.id);if(row.version!==pin.version||row.fingerprint!==pin.fingerprint)throw new PrivateDataError('conflict',409);this.assertCurrentRecord(row);}
  return evidence;
 }
 row(id:string):MemoryRow{this.state();const row=this.sql.get('SELECT * FROM mm_records WHERE user_id=$user AND id=?',id);if(!row)throw missing();return row as MemoryRow;}
 assertCurrentRecord(row:MemoryRow){
  const value=memorySchema.parse(JSON.parse(row.json));if(value.status!=='published')throw missing();
  const dependencies=this.sql.all('SELECT evidence_id,hash FROM mm_dependencies WHERE user_id=$user AND memory_id=?',row.id);
  if(!dependencies.length)throw missing();
  const records=this.evidence(dependencies.map(item=>String(item.evidence_id)));
  if(dependencies.some(dep=>memoryEvidenceFingerprint(records.find(record=>record.id===dep.evidence_id)!)!==dep.hash))throw new PrivateDataError('conflict',409);
  return value;
 }
 options(input:ScopedMemoryTask):MemoryExtractOptions{return {profile:input.profile,tier:input.phase==='integrate'?'consolidated':'episode',relatedMemoryIds:input.related.map(pin=>pin.id),expectedFingerprints:Object.fromEntries(input.inputs.map(pin=>[pin.id,pin.hash])),evidenceRanges:this.assertInputs(input).map(record=>({id:record.id,offset:0,length:record.ocrText.length}))};}
 validate(result:QueryResult,input:ScopedMemoryTask,related:readonly Memory[]=[]){
  const options=this.options(input),records=this.assertInputs(input);return validateMemoryExtraction(result,options,{readEvidence:ids=>{if(ids.some(id=>!input.inputs.some(pin=>pin.id===id)))throw missing();return records.filter(record=>ids.includes(record.id));},isCurrentEvidence:id=>{try{return this.evidence([id]).length===1;}catch{return false;}},get:id=>{const memory=related.find(item=>item.id===id);if(!memory)throw missing();return memory;}});
 }
 prepareExtract(result:QueryResult,input:ScopedMemoryTask,related:readonly Memory[]=[],receipt?:Memory['reviewReceipt']){
  if(!receipt||receipt.deletionSnapshot!==input.deletionSnapshot||receipt.resultHash!==memoryHashAnswer(result.answer)||receipt.decision!=='empty'&&!receipt.reviewRunId)throw new PrivateDataError('invalid_data');
  const claims=this.validate(result,input,related),createdAt=receipt.checkedAt;
  return claims.map(claim=>{
   const fingerprint=memoryHash([input.phase,claim.admission,claim.coding??null,claim.relations??null,claim.validFrom??null,claim.validUntil??null,claim.statement,[...claim.evidenceIds].sort(),claim.evidence]);
   const prior=this.sql.get('SELECT json FROM mm_records WHERE user_id=$user AND fingerprint=? AND json_extract(json,\'$.status\')=\'published\'',fingerprint);
   if(prior)return memorySchema.parse(JSON.parse(String(prior.json)));
   return memorySchema.parse({...claim,id:uuid([this.sql.userId,input.jobId,fingerprint]),version:1,fingerprint,tier:input.phase==='integrate'?'consolidated':'episode',kind:claim.kind??'episodic',createdAt,status:'published',model:receipt.model??'unknown',runId:result.runId,reviewRunId:receipt.reviewRunId,reviewReceipt:receipt});
  });
 }
 commit(records:readonly Memory[],input:ScopedMemoryTask){return this.sql.transaction(()=>{
  this.assertInputs(input);
  for(const value of records){
   const memory=memorySchema.parse(value),prior=this.sql.get('SELECT json FROM mm_records WHERE user_id=$user AND id=?',memory.id);
   if(prior&&memoryHash(JSON.parse(String(prior.json)))!==memoryHash(memory))throw new PrivateDataError('conflict',409);
   this.sql.run('INSERT OR IGNORE INTO mm_records VALUES($user,?,?,?,?,?,?,?)',memory.id,memory.version,memory.fingerprint,memoryBodyDigest(memory),JSON.stringify(input.binding),JSON.stringify(memory),memory.createdAt);
   this.sql.run('INSERT OR IGNORE INTO mm_versions VALUES($user,?,?,?,?)',memory.id,memory.version,memory.fingerprint,JSON.stringify(memory));
   for(const id of memory.evidenceIds){const pin=input.inputs.find(item=>item.id===id);if(!pin)throw missing();this.sql.run('INSERT OR IGNORE INTO mm_dependencies VALUES($user,?,?,?)',memory.id,id,pin.hash);}
   for(const relation of memory.relations??[])if(relation.kind==='supersedes'){
    const target=this.assertCurrentRecord(this.row(relation.memoryId));if(target.version!==relation.version||target.fingerprint!==relation.fingerprint)throw new PrivateDataError('conflict',409);
    const updated=memorySchema.parse({...target,supersededBy:memory.id,supersededAt:memory.validFrom??memory.createdAt,updatedAt:memory.createdAt});this.sql.run('UPDATE mm_records SET json=? WHERE user_id=$user AND id=?',JSON.stringify(updated),target.id);
   }
  }
  this.sql.run("UPDATE mm_jobs SET state='committed' WHERE user_id=$user AND id=?",input.jobId);return records;
 });}
 page(raw:unknown={}){
  this.state();const {cursor,...query}=pageSchema.parse(raw),position=cursor?this.cursor.decode(cursor,query):undefined,conditions=["json_extract(r.json,'$.status')='published'"],args:(string|number)[]=[];
  if(!query.includeHistory){const at=new Date().toISOString();conditions.push("json_extract(r.json,'$.supersededBy') IS NULL AND (json_extract(r.json,'$.validFrom') IS NULL OR julianday(json_extract(r.json,'$.validFrom'))<=julianday(?)) AND (json_extract(r.json,'$.validUntil') IS NULL OR julianday(json_extract(r.json,'$.validUntil'))>julianday(?))");args.push(at,at);}
  if(query.query){conditions.push('EXISTS(SELECT 1 FROM mm_fts f WHERE f.user_id=$user AND f.id=r.id AND instr(lower(f.text),lower(?))>0)');args.push(query.query);}
  if(position){conditions.push('(r.created_at<? OR (r.created_at=? AND r.id<?))');args.push(position.at,position.at,position.id);}
  const rows=this.sql.all(`SELECT r.* FROM mm_records r WHERE r.user_id=$user AND ${conditions.join(' AND ')} ORDER BY r.created_at DESC,r.id DESC LIMIT ?`,...args,query.limit+1) as MemoryRow[],last=rows.slice(0,query.limit).at(-1);
  return {rows:rows.slice(0,query.limit),nextCursor:rows.length>query.limit&&last?this.cursor.encode(query,{at:last.created_at,id:last.id}):null};
 }
 delete(id:string){return this.sql.transaction(()=>{
  const row=this.row(id),memory=memorySchema.parse(JSON.parse(row.json));
  const records=this.evidence(memory.evidenceIds),at=new Date().toISOString(),value={id:randomUUID(),memoryId:id,title:memory.title,statement:memory.statement,uncertainty:memory.uncertainty,deletedAt:at,originKeys:[...new Set(records.flatMap(record=>this.originKeys(record)))],lineageKeys:[...new Set(records.flatMap(record=>this.lineageKeys(record)))],originalTexts:records.map(record=>record.ocrText),dependencies:memory.evidenceIds,derivationSourceIds:[...new Set(records.map(record=>record.provenance!.sourceId!))],sourceLineageComplete:true};this.sql.run('INSERT OR IGNORE INTO mm_deletions VALUES($user,?,?)',id,JSON.stringify(value));
  this.sql.run('DELETE FROM mm_records WHERE user_id=$user AND id=?',id);
  this.sql.run('UPDATE mm_state SET generation=generation+1,revision=revision+1 WHERE user_id=$user');return {deleted:true};
 });}
 private originKeys(record:MemoryRecord){return ['bytes:'+memoryHash(record.ocrText),'event:'+memoryHash([record.provenance?.sourceId,record.provenance?.externalId,record.provenance?.revision])];}
 private lineageKeys(record:MemoryRecord){return ['source:'+memoryHash([record.provenance?.sourceId,record.provenance?.externalId])];}
 deletionReview(){return {snapshot:()=>this.deletionSnapshot(),review:(input:QueryInput,result:QueryResult,query:(input:QueryInput)=>Promise<QueryResult>)=>reviewMemoryDeletionCandidates(input,result,query,{snapshot:()=>this.deletionSnapshot(),rejections:()=>this.sql.all('SELECT json FROM mm_deletions WHERE user_id=$user ORDER BY id').map(row=>JSON.parse(String(row.json))),keys:id=>this.originKeys(this.evidence([id])[0]),lineage:id=>this.lineageKeys(this.evidence([id])[0]),read:ids=>ids.flatMap(id=>{try{return this.evidence([id]);}catch{return [];}})})};}
 control(kind:'pause'|'resume'|'stop',raw:unknown){
  const input=z.object({expectedRevision:z.number().int().positive(),operationId:z.string().uuid()}).strict().parse(raw),fingerprint=memoryHash({kind,input});
  return this.sql.transaction(()=>{const state=this.state(),prior=this.sql.get('SELECT fingerprint FROM mm_commands WHERE user_id=$user AND id=?',input.operationId);if(prior){if(prior.fingerprint!==fingerprint)throw new PrivateDataError('conflict',409);return state;}if(state.revision!==input.expectedRevision)throw new PrivateDataError('conflict',409);this.sql.run('UPDATE mm_state SET desired=?,generation=generation+?,revision=revision+1 WHERE user_id=$user',Number(kind==='resume'),Number(kind==='stop'));this.sql.run('INSERT INTO mm_commands VALUES($user,?,?)',input.operationId,fingerprint);return this.state();});
 }
}
const memoryHashAnswer=(value:string)=>createHash('sha256').update(value).digest('hex');
