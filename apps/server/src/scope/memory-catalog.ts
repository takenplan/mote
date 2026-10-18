import {attributionContextSchema,unknownAttributionContext,type AttributionContext} from '@mote/shared';
import type {QueryInput} from '@mote/agent';
import {z} from 'zod';
import {ExecutionFailure} from '../execution-engine.js';
import type {MemoryWorkMember} from '../memory-work-contract.js';
import {attachmentVisible} from './ingress-attachments.js';
import {memoryHash,type ScopedMemoryData} from './memory-data.js';
import type {ScopedMemoryTask} from './memory-schema.js';

const memberSchema=z.object({id:z.string().uuid(),materialId:z.string().regex(/^mat_[a-f0-9]{64}$/),sourceId:z.string().min(1),contextTime:z.string().optional(),attribution:z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict();
const receiptSchema=z.object({version:z.literal(1),userId:z.string(),members:z.array(memberSchema)}).strict();
/** A host-only receipt for metadata already serialized in memoryWork. It is
 * neither a body-read receipt nor permission to quote or complete a target. */
export type MemoryCatalogReceipt=z.infer<typeof receiptSchema>;
type Member=MemoryCatalogReceipt['members'][number];
type Anchor={id:string;material_id:string;material_revision:string;block_id:string;hash:string;attribution:string|null;context_at:string;source_id:string;image_capture_id:string|null};
const restricted=()=>new ExecutionFailure('stale','context_evidence_restricted');
const parse=<T>(value:unknown):T|undefined=>value===null||value===undefined?undefined:JSON.parse(String(value)) as T;
const stable=(value:unknown):unknown=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([left],[right])=>left.localeCompare(right)).map(([key,item])=>[key,stable(item)])):value;
const metadata=(context:AttributionContext)=>{
 const {ownerStatements:_,importStatements:__,sourceContextStatements:___,...value}=context;
 return memoryHash(stable(value));
};
function attribution(base?:AttributionContext,block?:AttributionContext){
 const value={...base??unknownAttributionContext(),...block},pins=new Map<string,NonNullable<AttributionContext['sourceContextDeclarations']>[number]>();
 for(const pin of [...base?.sourceContextDeclarations??[],...block?.sourceContextDeclarations??[]]){
  const prior=pins.get(pin.sourceId);if(prior&&(prior.version!==pin.version||prior.fingerprint!==pin.fingerprint))throw restricted();pins.set(pin.sourceId,pin);
 }
 if(pins.size)value.sourceContextDeclarations=[...pins.values()];
 return attributionContextSchema.parse(value);
}
function anchors(data:ScopedMemoryData,ids:readonly string[]){
 const rows=data.sql.all(`SELECT e.id,e.material_id,e.material_revision,e.block_id,e.hash,
   json_extract(e.json,'$.attributionContext') attribution,json_extract(e.json,'$.capturedAt') context_at,
   json_extract(e.json,'$.provenance.sourceId') source_id,o.capture_id image_capture_id
   FROM mm_evidence e LEFT JOIN mm_images i ON i.user_id=e.user_id AND i.id=e.id
   LEFT JOIN ig_originals o ON o.user_id=i.user_id AND o.id=i.original_id
   WHERE e.user_id=$user AND e.id IN(SELECT value FROM json_each(?))`,JSON.stringify([...new Set(ids)])) as unknown as Anchor[];
 return new Map(rows.map(row=>[row.id,row]));
}

/** Reconstruct only the original frozen member vectors for the unread catalog
 * and inspection history. A body-only revision must not erase metadata from
 * that catalog or force a successful independent target to be reevaluated. */
export function frozenMemoryCatalogMembers(data:ScopedMemoryData,input:ScopedMemoryTask):MemoryWorkMember[]{
 if(!input.ranges)throw restricted();
 const records=anchors(data,input.ranges.map(range=>range.id));
 return input.ranges.map(range=>{
  const record=records.get(range.id),pin=input.inputs.find(pin=>pin.id===range.id);
  if(!record||!pin||record.hash!==pin.hash)throw restricted();
  return {key:memoryHash([range,record.hash,input.strategy]),...range,fingerprint:record.hash,materialRef:'material:'+record.material_id+'@'+record.material_revision,sourceId:record.source_id,contextTime:record.context_at,...(record.attribution?{attributionContext:attributionContextSchema.parse(JSON.parse(record.attribution))}:{}),state:'pending',memoryIds:[]};
 });
}

function rows(task:QueryInput['taskContext']|QueryInput){
 if(!task)return [];
 const context='taskContext' in task?task.taskContext:task;
 if(!context||typeof context!=='object')return [];
 const work=(context as {memoryWork?:unknown}).memoryWork;if(!work||typeof work!=='object'||Array.isArray(work))return [];
 const value=work as Record<string,any>,history=(items:unknown)=>Array.isArray(items)?items.flatMap(item=>item&&typeof item==='object'?[...item.targets??[],...item.contextMembers??[]]:[]):[];
 const feedback=value.feedback&&typeof value.feedback==='object'?value.feedback:undefined;
 return [...['members','contextMembers','authorizedMembers'].flatMap(key=>Array.isArray(value[key])?value[key]:[]),...history(value.history),...(feedback?[...feedback.targets??[],...feedback.authorized??[],...history(feedback.history)]:[])];
}

/** Snapshot the exact source/time/declaration vectors that will be sent, rather
 * than silently replacing stale prompt metadata with a new current identity. */
export function snapshotMemoryCatalog(data:ScopedMemoryData,task:QueryInput['taskContext']|QueryInput):MemoryCatalogReceipt|undefined{
 if(!task)return;const values=rows(task);if(!values.length)return;
 const records=anchors(data,values.map(value=>String(value?.id))),members=new Map<string,Member>();
 for(const value of values){
  const record=records.get(value?.id),ref=typeof value?.materialRef==='string'?/^material:(mat_[a-f0-9]{64})@[a-f0-9]{64}$/.exec(value.materialRef):undefined;
  if(!record||!ref||ref[1]!==record.material_id||value.sourceId!==record.source_id)throw restricted();
  const member=memberSchema.parse({id:record.id,materialId:record.material_id,sourceId:value.sourceId,...(value.contextTime!==undefined?{contextTime:value.contextTime}:{}),...(value.attributionContext?{attribution:metadata(attributionContextSchema.parse(value.attributionContext))}:{})});
  members.set(JSON.stringify(member),member);
 }
 const receipt:MemoryCatalogReceipt={version:1,userId:data.sql.userId,members:[...members.values()]};assertMemoryCatalog(data,receipt);return receipt;
}

/** Current visibility, privacy and declaration checks use projected metadata
 * only. In particular, do not compare current body revisions or read ocrText,
 * Material text/block bodies, source originals, or the global archive here. */
export function assertMemoryCatalog(data:ScopedMemoryData,raw:MemoryCatalogReceipt|undefined):void{
 if(!raw)return;
 const parsed=receiptSchema.safeParse(raw);if(!parsed.success||parsed.data.userId!==data.sql.userId)throw restricted();
 const receipt=parsed.data,records=anchors(data,receipt.members.map(member=>member.id)),materials=new Map<string,Member[]>();
 for(const member of receipt.members){const record=records.get(member.id);if(!record||record.material_id!==member.materialId||record.source_id!==member.sourceId)throw restricted();const values=materials.get(member.materialId)??[];values.push(member);materials.set(member.materialId,values);}
 for(const [id,members] of materials){
  const head=data.sql.get(`SELECT m.revision,m.source_id,m.sequence,m.min_visible_sequence,
    json_extract(v.json,'$.kind') kind,json_extract(v.json,'$.attributionContext') attribution,
    json_extract(v.json,'$.origin.firstAt') first_at,json_extract(v.json,'$.artifacts') artifacts
    FROM pd_materials m JOIN pd_material_versions v ON v.user_id=m.user_id AND v.material_id=m.id AND v.revision=m.revision
    WHERE m.user_id=$user AND m.id=?`,id);
  if(!head||Number(head.sequence)<Number(head.min_visible_sequence)||members.some(member=>member.sourceId!==head.source_id))throw restricted();
  const artifacts=parse<{key:string;state:string;revision?:string}[]>(head.artifacts)??[];
  if(head.kind==='mote.coding-session'&&!artifacts.some(artifact=>artifact.key==='coding-dialogue'&&artifact.state==='ready'&&artifact.revision==='1'))throw restricted();
  // The relation tables carry transitive visibility without opening any body.
  const invalid=data.sql.get(`WITH RECURSIVE tree(id,revision) AS(SELECT ?,? UNION SELECT p.input_material_id,p.input_revision FROM pd_material_inputs p JOIN tree t ON p.material_id=t.id AND p.revision=t.revision WHERE p.user_id=$user)
    SELECT 1 FROM tree t LEFT JOIN pd_materials m ON m.user_id=$user AND m.id=t.id LEFT JOIN pd_material_versions v ON v.user_id=$user AND v.material_id=t.id AND v.revision=t.revision
    WHERE m.id IS NULL OR v.revision IS NULL OR v.sequence<m.min_visible_sequence
    OR EXISTS(SELECT 1 FROM pd_material_sources x LEFT JOIN pd_sources s ON s.user_id=x.user_id AND s.id=x.source_id WHERE x.user_id=$user AND x.material_id=t.id AND x.revision=t.revision AND(s.id IS NULL OR coalesce(json_extract(s.json,'$.enabled'),1)=0))
    OR EXISTS(SELECT 1 FROM pd_material_captures p LEFT JOIN pd_captures c ON c.user_id=p.user_id AND c.id=p.capture_id LEFT JOIN ig_capture_scopes b ON b.user_id=c.user_id AND b.capture_id=c.id LEFT JOIN pd_sources s ON s.user_id=c.user_id AND s.id=coalesce(c.source_id,json_extract(c.json,'$.ingressSourceId'),b.source_id)
      WHERE p.user_id=$user AND p.material_id=t.id AND p.revision=t.revision AND(c.id IS NULL OR coalesce(json_extract(c.json,'$.privacy.excluded'),0)!=0 OR coalesce(json_extract(c.json,'$.provenance.deleted'),0)!=0 OR(coalesce(c.source_id,json_extract(c.json,'$.ingressSourceId'),b.source_id) IS NOT NULL AND(s.id IS NULL OR coalesce(json_extract(s.json,'$.enabled'),1)=0)) OR NOT ${attachmentVisible('c')})) LIMIT 1`,id,String(head.revision));
  if(invalid)throw restricted();
  const blocks=data.sql.all(`SELECT json_extract(b.value,'$.id') id,json_extract(b.value,'$.kind') kind,json_extract(b.value,'$.memberIds') member_ids,
    json_extract(b.value,'$.evidenceContext.attributionContext') attribution,json_extract(b.value,'$.evidenceContext.observedAt') observed_at,
    (SELECT min(c.context_at) FROM json_each(b.value,'$.memberIds') n JOIN pd_material_captures p ON p.user_id=$user AND p.material_id=v.material_id AND p.revision=v.revision AND p.member_id=n.value JOIN pd_captures c ON c.user_id=p.user_id AND c.id=p.capture_id) captured_at
    FROM pd_material_versions v,json_each(v.json,'$.blocks') b WHERE v.user_id=$user AND v.material_id=? AND v.revision=?`,id,String(head.revision));
  const byId=new Map(blocks.map(block=>[String(block.id),block])),base=parse<AttributionContext>(head.attribution);
  for(const member of members){
   const record=records.get(member.id)!;
   const image=record.block_id.startsWith('image:');if(image&&!record.image_capture_id)throw restricted();
   const imageMember=image?data.sql.get('SELECT member_id FROM pd_material_captures WHERE user_id=$user AND material_id=? AND revision=? AND capture_id=?',id,String(head.revision),record.image_capture_id!):undefined;
   const block=image?blocks.find(block=>block.kind==='text'&&(parse<string[]>(block.member_ids)??[]).includes(String(imageMember?.member_id))):byId.get(record.block_id);
   if(!image&&!block)throw restricted();
   const current=attribution(base,parse<AttributionContext>(block?.attribution));
   if(member.attribution!==undefined&&member.attribution!==metadata(current))throw restricted();
   if(member.contextTime!==undefined&&member.contextTime!==String(block?.observed_at??head.first_at??block?.captured_at??record.context_at))throw restricted();
  }
 }
}
