import type {DatabaseSync} from 'node:sqlite';
import type {CaptureRecord} from '@mote/shared';
import type {Range} from '../store.js';
import {evidenceInterval,withinEvidenceScope,type EvidenceDimensions} from '../evidence-range.js';
import type {MaterialDraft} from './material-model.js';
import type {StoredCapture} from './capture-original.js';
import type {PrivateSql} from './private-data-sql.js';
import {missing} from './private-data-sql.js';

type Block=MaterialDraft['blocks'][number];
/** Host-only closure: capture bodies stay canonical; membership is loaded from
 * owner-bound immutable Material links, never copied from captured prose. */
export type EvidenceOriginals={captures:readonly CaptureRecord[];materials:Readonly<Record<string,readonly string[]>>};
export type EvidenceSelection=Range&{query?:string;kind?:string};
const terms=(query:string|undefined)=>query?.trim().split(/\s+/u).filter(Boolean).slice(0,12)??[];
function memberCaptures(member:MaterialDraft['members'][number],originals:EvidenceOriginals){return member.kind==='capture'?[member.ref.slice(8)]:member.kind==='material'?originals.materials[member.ref.replace(/^material:/u,'')]:undefined;}
function visibleOriginals(draft:MaterialDraft,originals:EvidenceOriginals){
 return !originals.captures.some(record=>record.privacy.excluded||record.provenance?.deleted)&&draft.members.every(member=>{const ids=memberCaptures(member,originals);return ids!==undefined&&ids.every(id=>originals.captures.some(record=>record.id===id));});
}
const originalSource=(record:EvidenceDimensions)=>(record as EvidenceDimensions&Pick<StoredCapture,'ingressSourceId'>).ingressSourceId??record.provenance?.sourceId??null;

/** Trusted member refs describe source dimensions independently of the internal
 * canonical anchor kind. No captured text can declare its own source or time. */
export function blockOriginals(draft:MaterialDraft,block:Block,originals:EvidenceOriginals){
 const ids=new Set(draft.members.filter(member=>block.memberIds.includes(member.id)).flatMap(member=>memberCaptures(member,originals)??[]));
 return originals.captures.filter(original=>ids.has(original.id));
}
export function blockDimensions(draft:MaterialDraft,block:Block,originals:EvidenceOriginals,createdAt:string):EvidenceDimensions[]{
 const members=blockOriginals(draft,block,originals),context=block.kind==='text'?block.evidenceContext:undefined;
 const fallback:EvidenceDimensions={deviceId:draft.origin.deviceId??draft.origin.sourceId,source:'message',appId:'mote.material',capturedAt:context?.observedAt??draft.origin.firstAt??createdAt,privacy:{excluded:false,redacted:false,mode:'none'},provenance:{sourceId:draft.origin.sourceId,externalId:draft.id,revision:'projection',layer:'snapshot',deleted:false,document:context?.document}};
 return members.length?members.map(original=>{const {ingressSourceId:_,originalImage:__,...publicOriginal}=original as StoredCapture;return {...publicOriginal,capturedAt:context?.observedAt??original.capturedAt,provenance:original.provenance?{...original.provenance,document:{...original.provenance.document,...context?.document}}:fallback.provenance};}): [fallback];
}
function blockProjection(draft:MaterialDraft,block:Block,originals:EvidenceOriginals,createdAt:string){
 const members=blockOriginals(draft,block,originals),dimensions=blockDimensions(draft,block,originals,createdAt);
 // Binding is an independent host fact. Synthetic presentation provenance must
 // never authorize a raw member whose actual ingress binding is absent.
 return {dimensions,bindings:members.length?members.map(originalSource):dimensions.map(originalSource)};
}
function readyBlock(draft:MaterialDraft,block:Block){return draft.coverage.state==='complete'||draft.artifacts?.some(artifact=>artifact.state==='ready'&&artifact.blockIds?.includes(block.id));}
export function blockWithinScope(draft:MaterialDraft,block:Block,originals:EvidenceOriginals,createdAt:string,scope:EvidenceSelection={}){
 // A mixed block is disclosed only when every declared original fits. Without
 // character lineage it cannot be trimmed by guessing which prose came from whom.
 const projection=blockProjection(draft,block,originals,createdAt);
 return visibleOriginals(draft,originals)&&block.memberIds.every(id=>{const member=draft.members.find(member=>member.id===id);return member!==undefined&&(member.kind!=='material'||Boolean(memberCaptures(member,originals)?.length));})&&readyBlock(draft,block)&&projection.dimensions.every((record,index)=>withinEvidenceScope(record,scope,projection.bindings[index]));
}
export function scopedMaterialBlocks(draft:MaterialDraft,originals:EvidenceOriginals,createdAt:string,scope:EvidenceSelection={},blockId?:string){
 const imageCapture=blockId?.startsWith('image:')?blockId.slice(6).split(':')[0]:undefined;
 return draft.blocks.filter(block=>{
  const selected=blockId===undefined||block.id===blockId||Boolean(imageCapture&&block.kind==='asset'&&block.mimeType.startsWith('image/')&&blockOriginals(draft,block,originals).some(original=>original.id===imageCapture));
  const canonicalKind=block.kind==='text'?'message':blockDimensions(draft,block,originals,createdAt)[0].source;
  return selected&&(!scope.kind||scope.kind===canonicalKind)&&(block.kind==='asset'||Boolean(block.text))&&blockWithinScope(draft,block,originals,createdAt,scope);
 });
}
function materialMatches(draft:MaterialDraft,originals:EvidenceOriginals,createdAt:string,scope:EvidenceSelection,blockId?:string){
 const blocks=scopedMaterialBlocks(draft,originals,createdAt,scope,blockId),text=[draft.title,...blocks.map(block=>block.kind==='text'?block.text:'')].join('\n').toLocaleLowerCase();
 return blocks.length>0&&terms(scope.query).every(term=>text.includes(term.toLocaleLowerCase()));
}
/** Only fixed JSON inputs, never a database callback or owner selector. The
 * vector worker installs these same functions on its read-only connection. */
export function installEvidenceProjection(db:DatabaseSync){
 db.function('me_capture_matches',{deterministic:true},(json,scope)=>{const record=JSON.parse(String(json));return Number(withinEvidenceScope(record,JSON.parse(String(scope)),originalSource(record)));});
 db.function('me_capture_at',{deterministic:true},json=>evidenceInterval(JSON.parse(String(json))).start);
 db.function('me_material_matches',{deterministic:true},(json,originals,createdAt,scope,blockId)=>Number(materialMatches(JSON.parse(String(json)),JSON.parse(String(originals)),String(createdAt),JSON.parse(String(scope)),blockId===null?undefined:String(blockId))));
 db.function('me_material_at',{deterministic:true},(json,originals,createdAt,scope)=>{
  const draft=JSON.parse(String(json)) as MaterialDraft,records=JSON.parse(String(originals)) as EvidenceOriginals,filter=JSON.parse(String(scope));
  return scopedMaterialBlocks(draft,records,String(createdAt),filter).flatMap(block=>blockDimensions(draft,block,records,String(createdAt))).map(record=>evidenceInterval(record).start).sort().at(-1)??String(createdAt);
 });
}
/** SQL lineage is account-bound before the projection runs, including all
 * transitive inputs. The pure projector only uses each block's declared refs. */
export function materialOriginalsSql(head='h',id='id',revision='revision'){
 return `(WITH RECURSIVE tree(id,revision) AS(
  SELECT ${head}.${id},${head}.${revision} UNION SELECT p.input_material_id,p.input_revision FROM pd_material_inputs p JOIN tree t ON p.material_id=t.id AND p.revision=t.revision WHERE p.user_id=$user
 ),lineage(root_id,root_revision,id,revision) AS(
  SELECT id,revision,id,revision FROM tree UNION SELECT t.root_id,t.root_revision,p.input_material_id,p.input_revision FROM pd_material_inputs p JOIN lineage t ON p.material_id=t.id AND p.revision=t.revision WHERE p.user_id=$user
 ) SELECT json_object(
  'captures',json((SELECT coalesce(json_group_array(json(c.json)),'[]') FROM pd_captures c WHERE c.user_id=$user AND c.id IN(SELECT d.capture_id FROM pd_material_captures d JOIN tree t ON t.id=d.material_id AND t.revision=d.revision WHERE d.user_id=$user))),
  'materials',json((SELECT coalesce(json_group_object(ref,json(ids)),'{}') FROM(SELECT t.root_id||'@'||t.root_revision ref,json_group_array(DISTINCT d.capture_id) ids FROM lineage t JOIN pd_material_captures d ON d.material_id=t.id AND d.revision=t.revision WHERE d.user_id=$user GROUP BY t.root_id,t.root_revision)))
 ))`;
}
export function materialScopeSql(scope:EvidenceSelection,args:(string|number)[],head='h',version='v',blockId='NULL'){
 args.push(JSON.stringify(scope));return `me_material_matches(${version}.json,${materialOriginalsSql(head)},${head}.created_at,?,${blockId})=1`;
}
export class EvidenceProjection{
 constructor(private readonly sql:PrivateSql){}
 material(id:string,revision:string){
  const row=this.sql.get('SELECT json,created_at FROM pd_material_versions WHERE user_id=$user AND material_id=? AND revision=?',id,revision);
  if(!row)throw Error('Evidence material unavailable');
  const draft=JSON.parse(String(row.json)) as MaterialDraft,originals=JSON.parse(String(this.sql.get(`SELECT ${materialOriginalsSql('v','material_id','revision')} originals FROM pd_material_versions v WHERE v.user_id=$user AND v.material_id=? AND v.revision=?`,id,revision)!.originals)) as EvidenceOriginals;
  const invalid=this.sql.get("SELECT 1 FROM pd_material_sources p LEFT JOIN pd_sources s ON s.user_id=p.user_id AND s.id=p.source_id WHERE p.user_id=$user AND p.material_id=? AND p.revision=? AND (s.id IS NULL OR coalesce(json_extract(s.json,'$.enabled'),0)!=1) LIMIT 1",id,revision);
  if(invalid||!visibleOriginals(draft,originals))throw missing();
  return {draft,originals,createdAt:String(row.created_at)};
 }
 private projection(record:CaptureRecord){
  const anchor=this.sql.get('SELECT material_id,material_revision,block_id FROM mm_evidence WHERE user_id=$user AND id=?',record.id);if(!anchor){const row=this.sql.get("SELECT coalesce(source_id,json_extract(json,'$.ingressSourceId')) source_id FROM pd_captures WHERE user_id=$user AND id=?",record.id);return {dimensions:[record],bindings:[typeof row?.source_id==='string'?row.source_id:null]};}
  const {draft,originals,createdAt}=this.material(String(anchor.material_id),String(anchor.material_revision)),block=draft.blocks.find(block=>block.id===anchor.block_id);
  return block?blockProjection(draft,block,originals,createdAt):{dimensions:[record],bindings:[originalSource(record)]};
 }
 dimensions(record:CaptureRecord):EvidenceDimensions[]{return this.projection(record).dimensions;}
 matches(record:CaptureRecord,scope:EvidenceSelection={}){const projection=this.projection(record);return (!scope.kind||record.source===scope.kind)&&projection.dimensions.every((value,index)=>withinEvidenceScope(value,scope,projection.bindings[index]));}
 /** Authorization closure is deliberately independent of presentation. A mixed
  * block has no exact character lineage and cannot become a fresh target. */
 captureLineage(record:CaptureRecord):string[]{
  const anchor=this.sql.get('SELECT material_id,material_revision,block_id FROM mm_evidence WHERE user_id=$user AND id=?',record.id);if(!anchor)return [record.id];
  const {draft,originals}=this.material(String(anchor.material_id),String(anchor.material_revision)),block=draft.blocks.find(block=>block.id===anchor.block_id);
  if(!block){const image=this.sql.get('SELECT o.capture_id FROM mm_images i JOIN ig_originals o ON o.user_id=i.user_id AND o.id=i.original_id WHERE i.user_id=$user AND o.user_id=$user AND i.id=?',record.id);return image?[String(image.capture_id)]:[];}
  return blockOriginals(draft,block,originals).map(record=>record.id);
 }
 /** Presentation can expose a proven common source; canonical source/hash stay
  * on the original record. Mixed source blocks never borrow the first member. */
 view(record:CaptureRecord):CaptureRecord&{sourceType?:CaptureRecord['source']}{const dimensions=this.dimensions(record),first=dimensions[0],uniform=dimensions.every(value=>value.source===first.source&&value.deviceId===first.deviceId&&value.appId===first.appId&&value.provenance?.sourceId===first.provenance?.sourceId);return uniform?{...record,...first,id:record.id,ocrText:record.ocrText,source:record.source,sourceType:first.source,...(first.provenance?{provenance:{...first.provenance,uri:record.provenance?.uri??first.provenance.uri}}:{})}:dimensions.every(value=>value.source===first.source)?{...record,sourceType:first.source}:record;}
 display(record:CaptureRecord):CaptureRecord{const view=this.view(record);return {...view,source:view.sourceType??view.source};}
}
