import {closeCaptureAdmissions} from './memory-admission-cutoff.js';
import {freezeIntegrationAdmissions} from './memory-integration.js';
import {EvidenceProjection,materialOriginalsSql} from './evidence-projection.js';
import {memoryEvaluationTime} from './memory-evaluation-context.js';
import {memorySearchQuery} from '../memory-search-query.js';
import {createHash,randomUUID} from 'node:crypto';
import {unknownAttributionContext,type QueryResult,type CaptureRecord} from '@mote/shared';
import {z} from 'zod';
import type {QueryInput} from '@mote/agent';
import {readMemoryWorkCoverage,type MemoryWorkMember} from '../memory-work-contract.js';
import {assertMemoryTargetSupport,memoryReadRanges} from '../memory-read-context.js';
import {MemoryOutputValidationError} from '../memory-errors.js';
import {reviewMemoryDeletionCandidates} from '../memory-deletion-review.js';
import {materialDependencyStatus} from '../material-readiness.js';
import {memorySchema,type Memory} from '../memory-schema.js';
import {memoryBodyDigest,memoryProviderKey,withMemoryHostState} from '../memory-provider-contract.js';
import {validateMemoryExtraction,memoryEvidenceFingerprint,type MemoryRecord,type MemoryExtractOptions,type PreparedMemoryExtraction} from '../memory-contract.js';
import {PrivateSql,PrivateCursor,PrivateDataError,missing} from './private-data-sql.js';
import type {PrivateData} from './private-data.js';
import {materialDraftSchema,type MaterialDraft} from './material-model.js';
import {memoryHash,memoryUUID} from './memory-identity.js';
export {memoryHash,memoryUUID} from './memory-identity.js';
import {memoryAttribution} from './memory-evidence-context.js';
import {memoryImage,memoryImageAnchors,memoryImageGrants} from './memory-images.js';
import {defaultMemorySettings,memoryBindingSchema,type ScopedMemoryBinding,type ScopedMemoryTask} from './memory-schema.js';

export type MemoryState={deleted:number;generation:number;revision:number;desired:number;settings:string;binding:string};
export type MemoryRow={id:string;version:number;fingerprint:string;body_digest:string;binding:string;json:string;created_at:string};
export const memoryPageFields={query:z.string().trim().min(1).max(500).optional(),cursor:z.string().max(8000).optional(),limit:z.coerce.number().int().min(1).max(100).default(30),includeHistory:z.boolean().default(false),includeStale:z.literal(false).optional(),asOf:z.string().datetime({offset:true}).optional(),after:z.string().datetime({offset:true}).optional(),before:z.string().datetime({offset:true}).optional(),appId:z.string().min(1).max(200).optional(),source:z.enum(['message','activity','memory','event','file','calendar','media','notification','screen','metric','ui_page','device_event','note']).optional(),collection:z.enum(['content','activity']).optional(),deviceId:z.string().min(1).max(128).optional(),sourceId:z.string().min(1).max(128).optional(),id:z.string().uuid().optional(),status:z.literal('published').optional(),kind:z.enum(['episodic','semantic','procedural']).optional(),domain:z.enum(['personal','coding']).optional(),tier:z.enum(['episode','consolidated']).optional(),layer:z.enum(['observation','memory']).optional(),admissionLayer:z.enum(['observation','memory']).optional(),projectKey:z.string().min(1).max(1000).optional(),repositoryKey:z.string().min(1).max(1000).optional(),provider:z.enum(['claude','codex','kimi']).optional(),sessionId:z.string().min(1).max(1000).optional()};
export const memoryPageInputSchema=z.object(memoryPageFields).strict();
const compatibleMemoryFilters=(value:{layer?:string;admissionLayer?:string;after?:string;before?:string})=>(!value.layer||!value.admissionLayer||value.layer===value.admissionLayer)&&(!value.after||!value.before||Date.parse(value.after)<Date.parse(value.before));
export const memoryPageSchema=memoryPageInputSchema.refine(compatibleMemoryFilters,'Conflicting or invalid Memory filters');
export const memoryOpeningPageInputSchema=memoryPageInputSchema.extend({status:z.enum(['published','proposed']).optional()});
export const memoryOpeningPageSchema=memoryOpeningPageInputSchema.refine(compatibleMemoryFilters,'Conflicting or invalid Memory filters');
export const memoryOpeningReadFiltersSchema=memoryOpeningPageInputSchema.omit({cursor:true,limit:true,id:true}).refine(compatibleMemoryFilters,'Conflicting or invalid Memory filters');
export type MemoryOpeningReadFilters=z.input<typeof memoryOpeningReadFiltersSchema>;
export const memoryReadFiltersSchema=memoryPageInputSchema.omit({cursor:true,limit:true,id:true}).refine(compatibleMemoryFilters,'Conflicting or invalid Memory filters');
export type MemoryReadFilters=z.input<typeof memoryReadFiltersSchema>;

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
 materialEvidence(materialId:string,revision?:string,sourceIds?:readonly string[],required:readonly string[]=['material']):MemoryRecord[]{
  return this.projectMaterialEvidence(materialId,revision,sourceIds,required,false);
 }
 /** Portable recovery validates canonical retained versions without admitting
  * them as current execution input. Ordinary evidence() stays current-only. */
 restoreMaterialEvidence(materialId:string,revision:string):MemoryRecord[]{return this.projectMaterialEvidence(materialId,revision,undefined,['material'],true);}
 private projectMaterialEvidence(materialId:string,revision:string|undefined,sourceIds:readonly string[]|undefined,required:readonly string[],retained:boolean):MemoryRecord[]{
  this.state();const material=this.privateData.material(materialId,revision),current=this.privateData.material(materialId);
  if(!retained&&material.revision!==current.revision)throw new PrivateDataError('conflict',409);if(!retained)new EvidenceProjection(this.sql).material(material.id,material.revision);
  if(sourceIds){const sources=this.sql.all('SELECT source_id FROM pd_material_sources WHERE user_id=$user AND material_id=? AND revision=?',material.id,material.revision);if(!sources.length||sources.some(row=>!sourceIds.includes(String(row.source_id))))throw missing();}
  const row=this.sql.get('SELECT json FROM pd_material_versions WHERE user_id=$user AND material_id=? AND revision=?',material.id,material.revision)!;
  const draft=materialDraftSchema.parse(JSON.parse(String(row.json)));
  if(!materialDependencyStatus(draft,required).ready)throw new PrivateDataError('conflict',409);
  if(['summary','image-interpretation'].includes(draft.kind)||draft.fidelity.state==='summary-only'){const parents=draft.members.filter(member=>member.kind==='material');if(!parents.length){if(draft.kind==='image-interpretation'){const anchors=this.sql.transaction(()=>memoryImageAnchors(this.sql,this.privateData,draft,material,[]));if(anchors.length)return anchors;}throw new PrivateDataError('scope_unavailable',503);}return parents.flatMap(parent=>{const at=parent.ref.lastIndexOf('@');return this.projectMaterialEvidence(parent.ref.slice(0,at),parent.ref.slice(at+1),sourceIds,['material'],retained);});}
  const artifacts=required.map(key=>draft.artifacts?.find(artifact=>artifact.key===key)),mapped=required.every((key,index)=>key!=='material'&&artifacts[index]?.blockIds!==undefined),selectedIds=mapped?new Set(artifacts.flatMap(artifact=>artifact!.blockIds!)):undefined,blocks=draft.blocks.filter(block=>!selectedIds||selectedIds.has(block.id)),memberIds=new Set(blocks.flatMap(block=>block.memberIds));
  return this.sql.transaction(()=>{const records=blocks.flatMap(block=>{
   if(block.kind!=='text'||!block.text)return [];
   const originals=draft.members.filter(member=>block.memberIds.includes(member.id)&&member.kind==='capture').map(member=>this.privateData.capture(member.ref.slice(8)));
   const attribution=memoryAttribution(this.privateData,draft.attributionContext,block.evidenceContext?.attributionContext);
   const id=memoryUUID([this.sql.userId,material.id,material.revision,block.id]),at=block.evidenceContext?.observedAt??draft.origin.firstAt??originals.map(record=>record.capturedAt).sort()[0]??material.createdAt;
   const coding=['claude','codex','kimi'].includes(draft.origin.provider??'')&&draft.origin.sessionId&&draft.origin.projectKey?{version:1 as const,provider:draft.origin.provider as 'claude'|'codex'|'kimi',sessionId:draft.origin.sessionId,projectKey:draft.origin.projectKey,projectName:draft.origin.projectName,projectIdentity:draft.origin.projectIdentity,repositoryKey:draft.origin.repositoryKey,branch:draft.origin.branch,eventId:block.id,role:'transcript' as const,part:0,parts:1}:undefined;
   const record:CaptureRecord={id,blobHash:null,imageMime:null,deviceId:draft.origin.deviceId??draft.origin.sourceId,deviceName:'Material',platform:'import',capturedAt:at,receivedAt:material.createdAt,durationMs:0,source:'message',appId:'mote.material',appName:draft.title,windowTitle:draft.title,ocrText:block.text,indexingStatus:'indexed',privacy:{excluded:false,redacted:false,mode:'none'},attributionContext:attribution,provenance:{sourceId:draft.origin.sourceId,externalId:material.id,revision:material.revision,layer:'snapshot',deleted:false,uri:material.ref+'#'+block.id,document:{...originals[0]?.provenance?.document,...block.evidenceContext?.document,...(coding?{coding}:{})}}};
   const hash=memoryEvidenceFingerprint(record),prior=this.sql.get('SELECT hash,json FROM mm_evidence WHERE user_id=$user AND id=?',id);
   if(prior&&(prior.hash!==hash||prior.json!==JSON.stringify(record)))throw new PrivateDataError('conflict',409);
   this.sql.run('INSERT OR IGNORE INTO mm_evidence VALUES($user,?,?,?,?,?,?)',id,material.id,material.revision,block.id,hash,JSON.stringify(record));return [record];
  });return [...records,...memoryImageAnchors(this.sql,this.privateData,mapped?{...draft,blocks,members:draft.members.filter(member=>memberIds.has(member.id))}:draft,material,records)];});
 }
 image(id:string){return memoryImage(this.sql,id);}
 imageGrants(ids:readonly string[]){return memoryImageGrants(this.sql,ids);}
 images(input:ScopedMemoryTask){return memoryImageGrants(this.sql,[...this.ranges(input),...input.contextRanges??[]].map(range=>range.id));}
 evidence(ids:readonly string[]):MemoryRecord[]{
  this.state();return [...new Set(ids)].map(id=>{
   const row=this.sql.get('SELECT * FROM mm_evidence WHERE user_id=$user AND id=?',id);if(!row)throw missing();
   const material=this.privateData.material(String(row.material_id));if(material.revision!==row.material_revision)throw new PrivateDataError('conflict',409);new EvidenceProjection(this.sql).material(material.id,material.revision);
   if(String(row.block_id).startsWith('image:')&&!this.image(id))throw missing();const record=JSON.parse(String(row.json)) as MemoryRecord;if(memoryEvidenceFingerprint(record)!==row.hash)throw new PrivateDataError('invalid_data');return record;
  });
 }
 /** Owner audit reads retained historical originals; it grants no execution
  * or query-context authority. Canonically hidden/deleted inputs still deny. */
 retainedEvidence(ids:readonly string[]):MemoryRecord[]{this.state();return [...new Set(ids)].map(id=>{const row=this.sql.get('SELECT * FROM mm_evidence WHERE user_id=$user AND id=?',id);if(!row)throw missing();this.privateData.material(String(row.material_id),String(row.material_revision));const record=JSON.parse(String(row.json)) as MemoryRecord;if(memoryEvidenceFingerprint(record)!==row.hash)throw new PrivateDataError('invalid_data');return record;});}
 assertSources(ids:readonly string[],sourceIds:readonly string[]){for(const id of ids){const evidence=this.sql.get('SELECT material_id,material_revision FROM mm_evidence WHERE user_id=$user AND id=?',id);if(!evidence)throw missing();const sources=this.sql.all('SELECT source_id FROM pd_material_sources WHERE user_id=$user AND material_id=? AND revision=?',evidence.material_id,evidence.material_revision);if(!sources.length||sources.some(row=>!sourceIds.includes(String(row.source_id))))throw missing();}}
 assertInputs(input:ScopedMemoryTask){
  const catalog=new Set([...input.inputs,...input.readInputs??[]].map(pin=>pin.id));if(input.evaluationContext.inputs.some(pin=>!catalog.has(pin.id)))throw new PrivateDataError('conflict',409);
  for(const pin of [...input.inputs,...input.readInputs??[]])memoryEvaluationTime(input,pin.id);
  const state=this.state();if(input.ownerParentJobId&&this.sql.get('SELECT job_id FROM mm_owner_cancellations WHERE user_id=$user AND job_id=?',input.ownerParentJobId))throw new PrivateDataError('conflict',409);if(state.generation!==input.generation||memoryHash(this.binding())!==memoryHash(input.binding)||input.deletionSnapshot!==this.deletionSnapshot())throw new PrivateDataError('conflict',409);
  if(input.automatic&&input.integrationWindowId){const window=this.sql.get('SELECT revoked FROM mm_integration_windows WHERE user_id=$user AND id=?',input.integrationWindowId);if(!window||window.revoked)throw new PrivateDataError('conflict',409);}
  else if(input.automatic){if(!input.intakeIds?.length)throw new PrivateDataError('conflict',409);for(const id of input.intakeIds){const receipt=this.sql.get('SELECT revoked FROM mm_intakes WHERE user_id=$user AND id=?',id);if(!receipt||receipt.revoked)throw new PrivateDataError('conflict',409);}}
  // Evidence-to-Material bindings are shared only within this synchronous check.
  // Current versions, dependency readiness and SQL authority are still re-read.
  const targetedMaterials=input.evidenceReadRanges?new Set(input.inputs.map(evidence=>this.sql.get('SELECT material_id FROM mm_evidence WHERE user_id=$user AND id=?',evidence.id)?.material_id)):undefined;
  for(const pin of input.materialPins??[]){if(targetedMaterials&&!targetedMaterials.has(pin.id))continue;const current=this.privateData.material(pin.id);if(current.revision!==pin.revision)throw new PrivateDataError('conflict',409);const version=this.sql.get('SELECT json FROM pd_material_versions WHERE user_id=$user AND material_id=? AND revision=?',pin.id,pin.revision);if(!version||!materialDependencyStatus(materialDraftSchema.parse(JSON.parse(String(version.json))),pin.required).ready)throw new PrivateDataError('conflict',409);}
  const pins=input.inputs,evidence=this.evidence(pins.map(pin=>pin.id));for(const pin of pins)if(memoryEvidenceFingerprint(evidence.find(item=>item.id===pin.id)!)!==pin.hash)throw new PrivateDataError('conflict',409);
  for(const pin of input.related){const row=this.row(pin.id);if(row.version!==pin.version||row.fingerprint!==pin.fingerprint)throw new PrivateDataError('conflict',409);this.assertCurrentRecord(row);}
  return evidence.filter(record=>input.inputs.some(pin=>pin.id===record.id));
 }
 row(id:string):MemoryRow{this.state();const row=this.sql.get('SELECT * FROM mm_records WHERE user_id=$user AND id=?',id);if(!row)throw missing();return row as MemoryRow;}
 assertCurrentRecord(row:MemoryRow){return this.assertRecord(row,false);}
 assertOpeningRecord(row:MemoryRow){return this.assertRecord(row,true);}
 private assertRecord(row:MemoryRow,opening:boolean){
  const value=memorySchema.parse(JSON.parse(row.json));if(value.status!=='published'&&(!opening||value.status!=='proposed'))throw missing();
  const dependencies=this.sql.all('SELECT evidence_id,hash FROM mm_dependencies WHERE user_id=$user AND memory_id=?',row.id);
  if(!dependencies.length)throw missing();
  const records=this.evidence(dependencies.map(item=>String(item.evidence_id)));
  if(dependencies.some(dep=>memoryEvidenceFingerprint(records.find(record=>record.id===dep.evidence_id)!)!==dep.hash))throw new PrivateDataError('conflict',409);
  return value;
 }
 ranges(input:ScopedMemoryTask){return input.ranges??this.assertInputs(input).map(record=>({id:record.id,offset:0,length:record.ocrText.length}));}
 members(input:ScopedMemoryTask):MemoryWorkMember[]{const ranges=this.ranges(input),records=this.readInputs(input,[...new Set(ranges.map(range=>range.id))]);return ranges.map(range=>{const record=records.find(item=>item.id===range.id);if(!record||range.offset+range.length>record.ocrText.length)throw missing();const evidence=this.sql.get('SELECT material_id,material_revision FROM mm_evidence WHERE user_id=$user AND id=?',record.id)!;return {materialRef:'material:'+evidence.material_id+'@'+evidence.material_revision,key:memoryHash([range,memoryEvidenceFingerprint(record),input.strategy,memoryEvaluationTime(input,range.id)]),...range,fingerprint:memoryEvidenceFingerprint(record),sourceId:record.provenance?.sourceId,attributionContext:record.attributionContext,contextTime:record.capturedAt,evaluationTime:memoryEvaluationTime(input,range.id),state:'pending' as const,memoryIds:[]};});}
 readInputs(input:ScopedMemoryTask,ids:readonly string[]=input.inputs.map(pin=>pin.id)){this.assertInputs(input);return this.readPinnedInputs(input,ids);}
 /** Only this synchronous ordered read shares a successful whole-input check.
  * Neither the validation nor its selected-read capability escapes this call. */
 readInputsInOrder(input:ScopedMemoryTask,ids:readonly string[]):MemoryRecord[]{
  let validated=false;const records:MemoryRecord[]=[];
  for(const id of ids){
   try{if(!validated){this.assertInputs(input);validated=true;}records.push(...this.readPinnedInputs(input,[id]));}
   catch(error){if(input.inputs.some(pin=>pin.id===id))throw error;}
  }
  return records;
 }
 private readPinnedInputs(input:ScopedMemoryTask,ids:readonly string[]){const authorized=[...input.inputs,...input.readInputs??[]];if(ids.some(id=>!authorized.some(pin=>pin.id===id)))throw missing();const records=this.evidence(ids);for(const record of records){if(memoryEvidenceFingerprint(record)!==authorized.find(pin=>pin.id===record.id)!.hash)throw new PrivateDataError('conflict',409);const evidence=this.sql.get('SELECT material_id FROM mm_evidence WHERE user_id=$user AND id=?',record.id)!,pins=input.materialPins?.filter(pin=>pin.id===evidence.material_id)??[];for(const pin of pins){const material=this.privateData.material(pin.id);if(material.revision!==pin.revision)throw new PrivateDataError('conflict',409);const version=this.sql.get('SELECT json FROM pd_material_versions WHERE user_id=$user AND material_id=? AND revision=?',pin.id,pin.revision);if(!version||!materialDependencyStatus(materialDraftSchema.parse(JSON.parse(String(version.json))),pin.required).ready)throw new PrivateDataError('conflict',409);}}return records;}
 assertReadReceipt(input:ScopedMemoryTask,result:QueryResult){return this.readInputs(input,memoryReadRanges(result,[...this.ranges(input),...input.contextRanges??[]],input.evidenceReadRanges).map(range=>range.id));}
 options(input:ScopedMemoryTask,result?:QueryResult):MemoryExtractOptions{const ranges=result?memoryReadRanges(result,[...this.ranges(input),...input.contextRanges??[]],input.evidenceReadRanges):[...this.ranges(input),...input.contextRanges??[]],ids=new Set(ranges.map(range=>range.id));return {workContract:input.strategy?.workContract,strategy:input.strategy,integration:input.integration,profile:input.profile,tier:input.phase==='integrate'?'consolidated':'episode',relatedMemoryIds:input.related.map(pin=>pin.id),expectedFingerprints:Object.fromEntries([...input.inputs,...input.readInputs??[]].filter(pin=>ids.has(pin.id)).map(pin=>[pin.id,pin.hash])),evidenceRanges:ranges};}
 validate(result:QueryResult,input:ScopedMemoryTask,related:readonly Memory[]=[]){
  const options=this.options(input,result),records=this.readInputs(input,Object.keys(options.expectedFingerprints!)),members=input.strategy?.workContract?this.members(input):undefined;
  // Shape/declarations, then exact evidence, then quote-backed ownership. A bad
  // quote must retain its actionable quote code instead of becoming coverage.
  if(members)readMemoryWorkCoverage(result,members,undefined,undefined,input.strategy!.workContract);
  const claims=validateMemoryExtraction(result,options,{readEvidence:ids=>{if(ids.some(id=>!Object.hasOwn(options.expectedFingerprints!,id)))throw missing();return records.filter(record=>ids.includes(record.id));},imageLocator:id=>{const image=this.image(id);return image?{sha256:String(image.hash)}:undefined;},isCurrentEvidence:id=>{try{return this.evidence([id]).length===1;}catch{return false;}},get:id=>{const memory=related.find(item=>item.id===id);if(!memory)throw missing();return memory;}});
  if(input.evidenceReadRanges)assertMemoryTargetSupport(result,this.ranges(input),id=>records.find(record=>record.id===id)?.ocrText);
  if(members){const coverage=readMemoryWorkCoverage(result,members,undefined,id=>records.find(record=>record.id===id)?.ocrText,input.strategy!.workContract);if(coverage.missing.length)throw new MemoryOutputValidationError('coverage','Every supplied target requires coverage',{workContract:input.strategy!.workContract});}
  return claims;
 }
 private claimFingerprint(claim:ReturnType<ScopedMemoryData['validate']>[number],input:ScopedMemoryTask){return memoryHash([input.phase,input.strategy??null,input.integration??null,claim.admission,claim.coding??null,claim.relations??null,claim.validFrom??null,claim.validUntil??null,claim.statement,[...claim.evidenceIds].sort(),claim.evidence]);}
 duplicateIds(result:QueryResult,input:ScopedMemoryTask,related:readonly Memory[]){return this.validate(result,input,related).flatMap(claim=>{const prior=this.sql.get('SELECT id FROM mm_records WHERE user_id=$user AND fingerprint=? AND json_extract(json,\'$.status\')=\'published\'',this.claimFingerprint(claim,input));return prior?[String(prior.id)]:[];});}
 prepareExtract(result:QueryResult,input:ScopedMemoryTask,related:readonly Memory[]=[],receipt?:Memory['reviewReceipt'],duplicates:readonly Memory[]=[]):PreparedMemoryExtraction{
  if(!receipt||receipt.deletionSnapshot!==input.deletionSnapshot||receipt.resultHash!==memoryHashAnswer(result.answer)||receipt.decision!=='empty'&&!receipt.reviewRunId)throw new PrivateDataError('invalid_data');
  const claims=this.validate(result,input,related),createdAt=receipt.checkedAt,changed=new Map<string,Memory>(),expected:Record<string,string|null>={};
  const expect=(id:string)=>{if(Object.hasOwn(expected,id))return;const prior=this.sql.get('SELECT json FROM mm_records WHERE user_id=$user AND id=?',id);expected[id]=prior?memoryHashAnswer(String(prior.json)):null;};
  const items=claims.map(claim=>{
   const fingerprint=this.claimFingerprint(claim,input),prior=this.sql.get('SELECT id,body_digest FROM mm_records WHERE user_id=$user AND fingerprint=? AND json_extract(json,\'$.status\')=\'published\'',fingerprint);
   if(prior){const existing=duplicates.find(memory=>memory.id===prior.id);if(!existing||memoryBodyDigest(existing)!==prior.body_digest)throw new PrivateDataError('scope_unavailable',503);expect(existing.id);return memorySchema.parse(existing);}
   const memory=memorySchema.parse({...claim,strategy:input.strategy,integration:input.integration,id:memoryUUID([this.sql.userId,input.jobId,fingerprint]),version:1,fingerprint,tier:input.phase==='integrate'?'consolidated':'episode',kind:claim.kind??'episodic',createdAt,status:'published',model:receipt.model??'unknown',runId:result.runId,reviewRunId:receipt.reviewRunId,reviewReceipt:receipt});expect(memory.id);changed.set(memory.id,memory);
   for(const relation of memory.relations??[])if(relation.kind==='supersedes'){
    const target=related.find(item=>item.id===relation.memoryId);if(!target||target.supersededBy||target.version!==relation.version||target.fingerprint!==relation.fingerprint||changed.has(target.id))throw new PrivateDataError('conflict',409);
    expect(target.id);changed.set(target.id,memorySchema.parse({...target,version:target.version+1,supersededBy:memory.id,supersededAt:memory.validFrom??receipt.contextTime??createdAt,updatedAt:createdAt}));
   }
   return memory;
  });return {at:createdAt,resultHash:receipt.resultHash!,items,changed:[...changed.values()],expected,deletionSnapshot:input.deletionSnapshot};
 }
 assertPrepared(prepared:PreparedMemoryExtraction,input:ScopedMemoryTask){
  // No await or mutation separates these reads: validate the whole input once,
  // then retain every selected evidence/hash/current-Material check.
  this.assertInputs(input);for(const memory of prepared.items)this.readPinnedInputs(input,memory.evidenceIds);if(prepared.deletionSnapshot!==this.deletionSnapshot())throw new PrivateDataError('conflict',409);
  for(const [id,hash] of Object.entries(prepared.expected)){const row=this.sql.get('SELECT json FROM mm_records WHERE user_id=$user AND id=?',id);if((row?memoryHashAnswer(String(row.json)):null)!==hash)throw new PrivateDataError('conflict',409);}
 }
 commit(prepared:PreparedMemoryExtraction,input:ScopedMemoryTask){return this.sql.transaction(()=>{
  this.assertPrepared(prepared,input);
  for(const memory of prepared.changed){
   memorySchema.parse(memory);const historical=this.sql.get('SELECT json FROM mm_versions WHERE user_id=$user AND id=? AND version=?',memory.id,memory.version);if(historical&&historical.json!==JSON.stringify(memory))throw new PrivateDataError('conflict',409);
   this.sql.run('INSERT INTO mm_records VALUES($user,?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET version=excluded.version,fingerprint=excluded.fingerprint,body_digest=excluded.body_digest,binding=excluded.binding,json=excluded.json',memory.id,memory.version,memory.fingerprint,memoryBodyDigest(memory),JSON.stringify(input.binding),JSON.stringify(memory),memory.createdAt);
   this.sql.run('INSERT OR IGNORE INTO mm_versions VALUES($user,?,?,?,?)',memory.id,memory.version,memory.fingerprint,JSON.stringify(memory));
   this.sql.run('INSERT OR IGNORE INTO mm_version_bindings VALUES($user,?,?,?,?)',memory.id,memory.version,JSON.stringify(input.binding),memoryBodyDigest(memory));
   for(const id of memory.evidenceIds){const pin=[...input.inputs,...input.readInputs??[]].find(item=>item.id===id);if(!pin)throw missing();this.sql.run('INSERT OR IGNORE INTO mm_dependencies VALUES($user,?,?,?)',memory.id,id,pin.hash);}
  }
  const batch=input.batchId?this.sql.get('SELECT review FROM mm_job_batches WHERE user_id=$user AND job_id=? AND id=?',input.jobId,input.batchId):undefined,state=batch?.review&&JSON.parse(String(batch.review)).coverage?.incomplete?'awaiting_context':'committed';
  if(input.batchId)this.sql.run("UPDATE mm_job_batches SET state=? WHERE user_id=$user AND job_id=? AND id=?",state,input.jobId,input.batchId);if(!this.sql.get("SELECT 1 FROM mm_job_batches WHERE user_id=$user AND job_id=? AND state!='committed'",input.jobId))this.sql.run("UPDATE mm_jobs SET state='committed' WHERE user_id=$user AND id=?",input.jobId);else if(!this.sql.get("SELECT id FROM mm_job_batches WHERE user_id=$user AND job_id=? AND state NOT IN ('committed','awaiting_context')",input.jobId))this.sql.run("UPDATE mm_jobs SET state='awaiting_context' WHERE user_id=$user AND id=?",input.jobId);return prepared.items;
 });}
 private filters(raw:unknown,sourceIds:readonly string[]|undefined,paginate:boolean,recordPins?:readonly {id:string;version:number;fingerprint:string}[],audit=false,opening=false){
  this.state();const {cursor,...query}=(opening?memoryOpeningPageSchema:memoryPageSchema).parse(raw),identity={collection:audit?'memory-owner-filtered-audit':opening?'memory-opening':'memory',...query,...(recordPins?{recordPins:memoryHash(recordPins)}:{}),...(sourceIds?{sourceIds:[...new Set(sourceIds)].sort()}: {})},position=cursor?this.cursor.decode(cursor,identity):undefined,conditions=[audit?"json_extract(r.json,'$.status')='stale'":opening?"json_extract(r.json,'$.status') IN ('published','proposed')":"json_extract(r.json,'$.status')='published'"],args:(string|number)[]=[];
  if(opening&&query.status){conditions.push("json_extract(r.json,'$.status')=?");args.push(query.status);}
  conditions.push("json_array_length(r.json,'$.evidenceIds')>0 AND NOT EXISTS(SELECT 1 FROM json_each(r.json,'$.evidenceIds') proof WHERE NOT EXISTS(SELECT 1 FROM mm_evidence e WHERE e.user_id=$user AND e.id=proof.value))");
  if(!audit)conditions.push(`NOT EXISTS(SELECT 1 FROM mm_evidence e JOIN json_each(r.json,'$.evidenceIds') proof ON proof.value=e.id JOIN pd_material_versions v ON v.user_id=e.user_id AND v.material_id=e.material_id AND v.revision=e.material_revision WHERE e.user_id=$user AND v.user_id=$user AND (me_material_matches(v.json,${materialOriginalsSql('e','material_id','material_revision','e.id')},v.created_at,'{}',e.block_id)!=1 OR EXISTS(SELECT 1 FROM pd_material_sources p LEFT JOIN pd_sources s ON s.user_id=p.user_id AND s.id=p.source_id WHERE p.user_id=$user AND p.material_id=e.material_id AND p.revision=e.material_revision AND(s.id IS NULL OR coalesce(json_extract(s.json,'$.enabled'),0)!=1))))`);
  // The complete transitive source set is restricted before FTS, ordering and
  // LIMIT. An empty host allowlist grants no records. It never means all sources.
  conditions.push('EXISTS(SELECT 1 FROM mm_dependencies d WHERE d.user_id=$user AND d.memory_id=r.id)');
  if(sourceIds){conditions.push(`NOT EXISTS(SELECT 1 FROM mm_evidence e JOIN json_each(r.json,'$.evidenceIds') proof ON proof.value=e.id WHERE e.user_id=$user AND (NOT EXISTS(SELECT 1 FROM pd_material_sources s WHERE s.user_id=$user AND s.material_id=e.material_id AND s.revision=e.material_revision) OR EXISTS(SELECT 1 FROM pd_material_sources s WHERE s.user_id=$user AND s.material_id=e.material_id AND s.revision=e.material_revision AND s.source_id NOT IN (SELECT value FROM json_each(?)))))`);args.push(JSON.stringify([...new Set(sourceIds)].sort()));}
  for(const [key,path] of [['domain','$.domain'],['tier','$.tier'],['kind','$.kind'],['id','$.id'],['admissionLayer','$.admission.layer'],['layer','$.admission.layer']] as const)if(query[key]){conditions.push('json_extract(r.json,?)=?');args.push(path,query[key]!);}
  const codingFilters=(['projectKey','repositoryKey','provider','sessionId'] as const).filter(key=>query[key]);
  if(codingFilters.length){conditions.push("json_array_length(r.json,'$.scopeRefs')>0");conditions.push(`NOT EXISTS(SELECT 1 FROM json_each(r.json,'$.scopeRefs') s WHERE ${codingFilters.map(key=>`coalesce(json_extract(s.value,'$.${key}'),'')!=?`).join(' OR ')})`);args.push(...codingFilters.map(key=>query[key]!));}
  if(query.sourceId){conditions.push("NOT EXISTS(SELECT 1 FROM mm_evidence e JOIN json_each(r.json,'$.evidenceIds') proof ON proof.value=e.id WHERE e.user_id=$user AND (NOT EXISTS(SELECT 1 FROM pd_material_sources s WHERE s.user_id=$user AND s.material_id=e.material_id AND s.revision=e.material_revision) OR EXISTS(SELECT 1 FROM pd_material_sources s WHERE s.user_id=$user AND s.material_id=e.material_id AND s.revision=e.material_revision AND s.source_id!=?)))");args.push(query.sourceId);}
  if(query.deviceId||query.appId||query.source||query.collection||query.after||query.before){
   const {after,before,deviceId,appId,source,collection}=query;
   conditions.push(`NOT EXISTS(SELECT 1 FROM mm_evidence e JOIN json_each(r.json,'$.evidenceIds') proof ON proof.value=e.id JOIN pd_material_versions v ON v.user_id=e.user_id AND v.material_id=e.material_id AND v.revision=e.material_revision WHERE e.user_id=$user AND v.user_id=$user AND me_material_matches(v.json,${materialOriginalsSql('e','material_id','material_revision','e.id')},v.created_at,?,e.block_id)!=1)`);
   args.push(JSON.stringify({after,before,deviceId,appId,source,collection}));
  }

  if(!query.includeHistory){const at=query.asOf??new Date().toISOString();conditions.push("(json_extract(r.json,'$.supersededBy') IS NULL OR julianday(json_extract(r.json,'$.supersededAt'))>julianday(?)) AND (json_extract(r.json,'$.validFrom') IS NULL OR julianday(json_extract(r.json,'$.validFrom'))<=julianday(?)) AND (json_extract(r.json,'$.validUntil') IS NULL OR julianday(json_extract(r.json,'$.validUntil'))>julianday(?))");args.push(at,at,at);}
  if(query.query){const {match,short}=memorySearchQuery(query.query);if(match){conditions.push('r.id IN(SELECT id FROM mm_fts WHERE mm_fts.user_id=$user AND mm_fts MATCH ?)');args.push(match);}for(const term of short){conditions.push('r.id IN(SELECT id FROM mm_fts WHERE mm_fts.user_id=$user AND instr(lower(text),lower(?))>0)');args.push(term);}}
  if(paginate&&position){conditions.push('(r.created_at<? OR (r.created_at=? AND r.id<?))');args.push(position.at,position.at,position.id);}
  return {query,identity,conditions,args};
 }
 page(raw:unknown={},sourceIds?:readonly string[],recordPins?:readonly {id:string;version:number;fingerprint:string}[],opening=false){
  const {query,identity,conditions,args}=this.filters(raw,sourceIds,true,recordPins,false,opening);if(recordPins){conditions.push("EXISTS(SELECT 1 FROM json_each(?) frozen WHERE json_extract(frozen.value,'$.id')=r.id AND json_extract(frozen.value,'$.version')=r.version AND json_extract(frozen.value,'$.fingerprint')=json_extract(r.json,'$.fingerprint'))");args.push(JSON.stringify(recordPins));}
  const rows=this.sql.all(`SELECT r.* FROM mm_records r WHERE r.user_id=$user AND ${conditions.join(' AND ')} ORDER BY r.created_at DESC,r.id DESC LIMIT ?`,...args,query.limit+1) as MemoryRow[],last=rows.slice(0,query.limit).at(-1);
  return {rows:rows.slice(0,query.limit),nextCursor:rows.length>query.limit&&last?this.cursor.encode(identity,{at:last.created_at,id:last.id}):null};
 }
 /** Human-only stale review shares the original literal filters and their
  * complete source predicates, but never the current Memory capability. */
 auditPage(raw:unknown){
  const {query,identity,conditions,args}=this.filters(raw,undefined,true,undefined,true),rows=this.sql.all(`SELECT r.* FROM mm_records r WHERE r.user_id=$user AND ${conditions.join(' AND ')} ORDER BY r.created_at DESC,r.id DESC LIMIT ?`,...args,query.limit+1) as MemoryRow[],last=rows.slice(0,query.limit).at(-1);
  return {items:rows.slice(0,query.limit).map(row=>({id:row.id,version:row.version,kind:'stale' as const,usableAsMemory:false as const})),nextCursor:rows.length>query.limit&&last?this.cursor.encode(identity,{at:last.created_at,id:last.id}):null};
 }
 /** Literal host record only. Both page and exact/history reads use these same
  * SQL predicates before any external provider is given its exact key. */
 matches(memory:Memory,raw:unknown={},sourceIds?:readonly string[],opening=false){
  const filters=(opening?memoryOpeningReadFiltersSchema:memoryReadFiltersSchema).parse(raw),{conditions,args}=this.filters(filters,sourceIds,false,undefined,false,opening);
  return Boolean(this.sql.get(`SELECT r.id FROM (SELECT $user user_id,? id,? json,? created_at) r WHERE r.user_id=$user AND ${conditions.join(' AND ')}`,memory.id,JSON.stringify(memory),memory.createdAt,...args));
 }
 rankedPage(raw:unknown,ids:readonly string[],sourceIds?:readonly string[],recordPins?:readonly {id:string;version:number;fingerprint:string}[],opening=false){
  const {cursor,...query}=(opening?memoryOpeningPageSchema:memoryPageSchema).parse(raw),identity={collection:opening?'memory-opening-provider':'memory-provider',...query,...(sourceIds?{sourceIds:[...new Set(sourceIds)].sort()}: {}),...(recordPins?{recordPins:memoryHash(recordPins)}:{}),binding:this.binding(),ranked:memoryHash(ids)},position=cursor?this.cursor.decode(cursor,identity):undefined,start=position?Number(position.at):0;
  if(!Number.isSafeInteger(start)||start<0||start>ids.length||position&&ids[start-1]!==position.id)throw new PrivateDataError('invalid_cursor');
  const end=Math.min(start+query.limit,ids.length),items=ids.slice(start,end);return {ids:items,nextCursor:end<ids.length?this.cursor.encode(identity,{at:String(end),id:ids[end-1]}):null};
 }
 delete(id:string){return this.sql.transaction(()=>{
  const row=this.row(id),memory=memorySchema.parse(JSON.parse(row.json));
  const records=memory.evidenceIds.flatMap(id=>{const evidence=this.sql.get('SELECT json FROM mm_evidence WHERE user_id=$user AND id=?',id);return evidence?[JSON.parse(String(evidence.json)) as MemoryRecord]:[];}),at=new Date().toISOString(),value={id:randomUUID(),memoryId:id,title:memory.title,statement:memory.statement,uncertainty:memory.uncertainty,deletedAt:at,originKeys:[...new Set(records.flatMap(record=>this.originKeys(record)))],lineageKeys:[...new Set(records.flatMap(record=>this.lineageKeys(record)))],originalTexts:records.map(record=>record.ocrText),dependencies:memory.evidenceIds,derivationSourceIds:[...new Set(records.map(record=>record.provenance!.sourceId!))],sourceLineageComplete:true};this.sql.run('INSERT OR IGNORE INTO mm_deletions VALUES($user,?,?)',id,JSON.stringify(value));
  const retiredIds=this.sql.all("WITH RECURSIVE affected(id) AS (SELECT ? UNION SELECT r.id FROM mm_records r,affected a,json_each(r.json,'$.relatedMemoryIds') p WHERE r.user_id=$user AND p.value=a.id) SELECT id FROM affected WHERE id!=?",id,id).map(row=>String(row.id));for(const dependent of retiredIds)this.sql.run("UPDATE mm_records SET json=json_set(json,'$.status','stale','$.staleReason','memory_deleted') WHERE user_id=$user AND id=?",dependent);
  this.sql.run('DELETE FROM mm_records WHERE user_id=$user AND id=?',id);
  this.sql.run('UPDATE mm_state SET generation=generation+1,revision=revision+1 WHERE user_id=$user');return {deleted:true,retiredIds};
 });}
 private originKeys(record:MemoryRecord){return ['bytes:'+memoryHash(record.ocrText),'event:'+memoryHash([record.provenance?.sourceId,record.provenance?.externalId,record.provenance?.revision])];}
 private lineageKeys(record:MemoryRecord){return ['source:'+memoryHash([record.provenance?.sourceId,record.provenance?.externalId])];}
 deletionReview(){return {snapshot:()=>this.deletionSnapshot(),review:(input:QueryInput,result:QueryResult,query:(input:QueryInput)=>Promise<QueryResult>)=>reviewMemoryDeletionCandidates(input,result,query,{snapshot:()=>this.deletionSnapshot(),rejections:()=>this.sql.all('SELECT json FROM mm_deletions WHERE user_id=$user ORDER BY id').map(row=>JSON.parse(String(row.json))),keys:id=>this.originKeys(this.evidence([id])[0]),lineage:id=>this.lineageKeys(this.evidence([id])[0]),read:ids=>ids.flatMap(id=>{try{return this.evidence([id]);}catch{return [];}})})};}
 control(kind:'pause'|'resume'|'stop',raw:unknown){
  const input=z.object({expectedRevision:z.number().int().positive(),operationId:z.string().uuid()}).strict().parse(raw),fingerprint=memoryHash({kind,input});
  return this.sql.transaction(()=>{const state=this.state(),prior=this.sql.get('SELECT fingerprint FROM mm_commands WHERE user_id=$user AND id=?',input.operationId);if(prior){if(prior.fingerprint!==fingerprint)throw new PrivateDataError('conflict',409);return state;}if(state.revision!==input.expectedRevision)throw new PrivateDataError('conflict',409);this.sql.run('UPDATE mm_state SET desired=?,generation=generation,revision=revision+1 WHERE user_id=$user',Number(kind==='resume'));if(kind==='pause'){closeCaptureAdmissions(this.sql);freezeIntegrationAdmissions(this);}if(kind==='stop'){this.sql.run('UPDATE mm_capture_intakes SET revoked=1 WHERE user_id=$user');this.sql.run('UPDATE mm_intakes SET revoked=1 WHERE user_id=$user');this.sql.run('UPDATE mm_integration_windows SET revoked=1 WHERE user_id=$user');for(const row of this.sql.all('SELECT id,version,fingerprint FROM mm_records WHERE user_id=$user'))this.sql.run('INSERT OR IGNORE INTO mm_integrated_versions VALUES($user,?,?,?,?)',row.id,row.version,row.fingerprint,'stopped:'+input.operationId);}this.sql.run('INSERT INTO mm_commands VALUES($user,?,?)',input.operationId,fingerprint);return this.state();});
 }
}
const memoryHashAnswer=(value:string)=>createHash('sha256').update(value).digest('hex');
