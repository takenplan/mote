import {z} from 'zod';
import {materialDraftSchema} from './material-model.js';
import {PrivateDataError} from './private-data-sql.js';
import type {ScopedMemoryData} from './memory-data.js';
import {memoryEvidenceFingerprint} from '../memory-contract.js';
import {memoryStrategyRefSchema} from '../memory-strategy-contract.js';

export const memorySelectionSchema=z.object({captureId:z.string().uuid().optional(),after:z.string().datetime({offset:true}).optional(),before:z.string().datetime({offset:true}).optional(),deviceId:z.string().min(1).max(128).optional(),recipes:z.string().max(4096).transform((value,ctx)=>{try{return JSON.parse(value);}catch{ctx.addIssue({code:'custom',message:'Invalid recipes'});return z.NEVER;}}).pipe(z.array(memoryStrategyRefSchema).min(1).max(10)).optional()}).strict().refine(v=>!v.captureId||!v.after&&!v.before&&!v.deviceId,'A single original has its own scope').refine(v=>!v.after||!v.before||Date.parse(v.after)<Date.parse(v.before),'Invalid time range');
/** A read-only canonical selection over the existing complete browser pages.
 * No task/grant is admitted here. Block membership, rather than a Material's
 * update time or a group title, decides whether it is wholly inside selection. */
export function memoryCaptureSelection(data:ScopedMemoryData,query:z.infer<typeof memorySelectionSchema>,required:readonly (readonly string[])[]){
 const browser=data.privateData.captureBrowser(true),ids:string[]=[];
 if(query.captureId){browser.record(query.captureId);ids.push(query.captureId);}
 else{let cursor:string|undefined;do{const page=browser.previews({...(query.after?{after:query.after}:{}),...(query.before?{before:query.before}:{}),...(query.deviceId?{deviceId:query.deviceId}:{}),collection:'content',limit:60,...(cursor?{cursor}:{})});ids.push(...page.items.map(item=>item.id));cursor=page.nextCursor??undefined;}while(cursor);}
 const selected=new Set(ids),covered=required.map(()=>new Set<string>()),materialRevisions:Record<string,string>={},evidencePins=new Map<string,{id:string;hash:string}>();
 if(!ids.length)return {status:'empty' as const,materialRevisions,evidencePins:[],captureCount:0};
 const candidates=data.sql.all(`WITH RECURSIVE links(id,revision) AS (
 SELECT c.material_id,c.revision FROM pd_material_captures c WHERE c.user_id=$user AND c.capture_id IN(SELECT value FROM json_each(?))
 UNION SELECT d.material_id,d.revision FROM pd_material_inputs d JOIN links l ON l.id=d.input_material_id AND l.revision=d.input_revision WHERE d.user_id=$user)
 SELECT DISTINCT h.id,h.revision FROM links l JOIN pd_materials h ON h.id=l.id AND h.revision=l.revision WHERE h.user_id=$user AND h.sequence>=h.min_visible_sequence ORDER BY h.id`,JSON.stringify(ids));
 const captures=(materialId:string,revision:string,memberIds?:readonly string[],visiting=new Set<string>()):string[]=>{
  const key=materialId+'@'+revision;if(visiting.has(key))throw new PrivateDataError('conflict',409);const seen=new Set(visiting).add(key),row=data.sql.get('SELECT json FROM pd_material_versions WHERE user_id=$user AND material_id=? AND revision=?',materialId,revision);if(!row)throw new PrivateDataError('conflict',409);const draft=materialDraftSchema.parse(JSON.parse(String(row.json)));
  return draft.members.filter(member=>!memberIds||memberIds.includes(member.id)).flatMap(member=>member.kind==='capture'?[member.ref.slice(8)]:member.kind==='material'?captures(member.ref.slice(0,member.ref.lastIndexOf('@')).replace(/^material:/,''),member.ref.slice(member.ref.lastIndexOf('@')+1),undefined,seen):[]);
 };
 for(const candidate of candidates)for(const [index,needs] of required.entries()){
  let records:ReturnType<ScopedMemoryData['materialEvidence']>;try{records=data.materialEvidence(String(candidate.id),String(candidate.revision),undefined,needs);}catch(error){if(error instanceof PrivateDataError&&[404,409].includes(error.statusCode)){continue;}throw error;}
  for(const record of records){const row=data.sql.get('SELECT material_id,material_revision,block_id FROM mm_evidence WHERE user_id=$user AND id=?',record.id)!,materialId=String(row.material_id),revision=String(row.material_revision),image=data.sql.get('SELECT o.capture_id FROM mm_images i JOIN ig_originals o ON o.user_id=i.user_id AND o.id=i.original_id WHERE i.user_id=$user AND o.user_id=$user AND i.id=?',record.id),draft=materialDraftSchema.parse(JSON.parse(String(data.sql.get('SELECT json FROM pd_material_versions WHERE user_id=$user AND material_id=? AND revision=?',materialId,revision)!.json))),block=draft.blocks.find(block=>block.id===row.block_id),members=image?[String(image.capture_id)]:block?captures(materialId,revision,block.memberIds):[];
   if(!members.length||members.some(id=>!selected.has(id)))continue;
   // Re-read current source heads/privacy/attachment visibility, not a retained
   // version merely reachable from a group. Ambiguous mixed blocks are omitted.
   for(const id of members){browser.record(id);covered[index].add(id);}
   materialRevisions[materialId]=revision;evidencePins.set(record.id,{id:record.id,hash:memoryEvidenceFingerprint(record)});
  }
 }
 return {status:evidencePins.size&&covered.every(ids=>ids.size===selected.size)?'ready' as const:'waiting' as const,materialRevisions,evidencePins:[...evidencePins.values()],captureCount:ids.length};
}
