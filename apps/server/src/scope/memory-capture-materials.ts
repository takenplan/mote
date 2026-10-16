import {z} from 'zod';
import {observationKey} from '../observation-key.js';
import type {CaptureRecord} from '@mote/shared';
import {transcriptSchema} from '@mote/shared';
import {MaterialOrganizerRegistry,sourceItem,codingSession,uiPageObject,screenGroup,captureEvent,stateSeries,authored,type MaterialOrganizerReader,type MaterialOrganizerFile,uiPageObservation,MAX_TEXT} from '../material-organizer-contract.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import {ExecutionFailure} from '../execution-engine.js';
import type {TaskExecution,TaskRun} from './task-execution.js';
import type {UserContext} from './context.js';
import type {IngressHost,IngressReceipt} from './ingress.js';
import type {ProcessingHost} from './processing.js';
import {memoryHash,type ScopedMemoryData} from './memory-data.js';
import {PrivateDataError} from './private-data-sql.js';
const inputSchema=z.object({captureId:z.string().uuid(),sourceId:z.string().min(1),hash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
/** The existing pure organizers run under an M05 host grant. Raw originals stay
 * immutable: OCR and model interpretations are read from real M06 products. */
export class MemoryCaptureMaterials {
 private readonly registry=new MaterialOrganizerRegistry();
 private readonly disposers:Array<()=>void|Promise<void>>=[];
 constructor(private readonly data:(context:UserContext)=>ScopedMemoryData,private readonly execution:TaskExecution,private readonly published:(run:TaskRun,material:{id:string;revision:string})=>void){
  for(const organizer of [sourceItem,codingSession,uiPageObject,screenGroup,captureEvent,stateSeries,authored])this.registry.register(organizer);
  this.disposers.push(execution.register({kind:'memory.materials',pool:'memory.materials',concurrency:()=>4,policy:EXECUTION_POLICIES.deterministic,parseInput:value=>inputSchema.parse(value),authorizeInput:(context,raw)=>this.input(context,inputSchema.parse(raw)),resources:raw=>[{scope:'user',key:'memory-material:'+String(raw.sourceId)}],execute:async run=>{const {data,record}=this.input(run.context,inputSchema.parse(run.task.input));run.grant.commit(()=>this.publish(run));const image=this.file(data,record.id).image;if(image?.jobs.some(job=>job.state==='pending'))throw new ExecutionFailure('waiting','memory_image_products_pending',100,{executionStarted:false});return {};},commit:run=>this.publish(run),classify:error=>error instanceof ExecutionFailure?error:new ExecutionFailure('stale','memory_capture_changed')}));
 }
 bind(ingress:IngressHost,processing:ProcessingHost){
  this.disposers.push(ingress.onAccepted((context,receipt)=>this.accept(context,receipt)));
  this.disposers.push(processing.onMaterialPublished((run,material)=>{const data=this.data(run.context);for(const member of data.sql.all('SELECT DISTINCT c.capture_id,s.source_id FROM pd_material_captures c LEFT JOIN ig_capture_scopes s ON s.user_id=c.user_id AND s.capture_id=c.capture_id WHERE c.user_id=$user AND s.user_id=$user AND c.material_id=? AND c.revision=?',material.id,material.revision))this.enqueue(run.context,String(member.capture_id),String(member.source_id),material.revision);}));
 }
 private accept(context:UserContext,receipt:IngressReceipt){for(const item of receipt.captures)if(!item.duplicate)this.enqueue(context,item.id,receipt.sourceId,'intake');}
 private enqueue(context:UserContext,captureId:string,sourceId:string,event:string){const data=this.data(context),record=data.privateData.capture(captureId);if(record.provenance?.deleted)return;const hash=memoryHash(record);this.execution.forUser(context).submitSync({kind:'memory.materials',operationId:'memory-materials:'+memoryHash([captureId,sourceId,hash,event]),input:{captureId,sourceId,hash}});}
 private input(context:UserContext,input:z.infer<typeof inputSchema>){const data=this.data(context),record=data.privateData.capture(input.captureId),source=data.privateData.source(input.sourceId),binding=data.sql.get('SELECT source_id FROM ig_capture_scopes WHERE user_id=$user AND capture_id=?',record.id);if(memoryHash(record)!==input.hash||(binding?.source_id??record.provenance?.sourceId)!==source.id||record.provenance?.deleted)throw new PrivateDataError('conflict',409);if(record.provenance&&data.privateData.sourceItem(record.provenance.sourceId,record.provenance.externalId)?.captureId!==record.id)throw new PrivateDataError('conflict',409);return {data,record,source};}
 private publish(run:TaskRun){
  const input=inputSchema.parse(run.task.input),{data,record,source}=this.input(run.context,input),allowed=new Set<string>();
  const permit=(record:CaptureRecord|undefined)=>{if(record){allowed.add(record.id);return this.project(data,record);}return undefined;};
  for(const {organizer,group} of this.registry.select({...record,groupKey:observationKey(record)} as CaptureRecord)){
   // M06 owns original-file/source-item publication. Other organizers consume
   // its exact products; a raw text source item still uses the existing builder.
   if(organizer.id===sourceItem.id&&data.sql.get('SELECT id FROM ig_originals WHERE user_id=$user AND capture_id=?',record.id))continue;
   const sameGroup=(limit:number,extra:string,args:(string|number)[],options:{ascending?:boolean;pageBudget?:boolean}={})=>{const rows=data.sql.all(`SELECT c.id FROM pd_captures c LEFT JOIN ig_capture_scopes s ON s.user_id=c.user_id AND s.capture_id=c.id WHERE c.user_id=$user AND (s.user_id=$user OR s.user_id IS NULL) AND (s.source_id=? OR(s.source_id IS NULL AND c.source_id=?)) AND ${extra} ORDER BY c.context_at ${options.ascending?'ASC':'DESC'},c.id ${options.ascending?'ASC':'DESC'} LIMIT ?`,source.id,source.id,...args,limit+1),records:CaptureRecord[]=[];let truncated=rows.length>limit,characters=2;for(const row of rows.slice(0,limit)){const value=data.privateData.capture(String(row.id));if(options.pageBudget){const page=value.metadata?.uiPage;if(page?.version!==2)continue;const {body:paragraphs,identity:_,...fields}=page.objects[0]!,cost=JSON.stringify(fields).length+paragraphs.reduce((sum,p)=>sum+p.text.length,0)+JSON.stringify(uiPageObservation(value)).length+1;if(characters+cost>MAX_TEXT){truncated=true;break;}characters+=cost;}records.push(permit(value)!);}return {records,truncated};};
   const reader:MaterialOrganizerReader={capture:()=>permit(record),sourceHead:()=>{const head=data.privateData.sourceItem(group.sourceId,group.externalId);return head?permit(data.privateData.capture(head.captureId)):undefined;},
    codingSession:()=>sameGroup(2000,"json_extract(c.json,'$.provenance.document.coding.provider')=? AND json_extract(c.json,'$.provenance.document.coding.projectKey')=? AND json_extract(c.json,'$.provenance.document.coding.sessionId')=? AND EXISTS(SELECT 1 FROM pd_source_heads h WHERE h.user_id=c.user_id AND h.capture_id=c.id)",[group.provider,group.projectKey,group.sessionId]),
    screenGroup:()=>{const start=Math.floor(Date.parse(record.capturedAt)/300000)*300000;return sameGroup(1000,"json_extract(c.json,'$.deviceId')=? AND json_extract(c.json,'$.source')=? AND coalesce(json_extract(c.json,'$.appId'),'')=? AND coalesce(json_extract(c.json,'$.windowTitle'),'')=? AND coalesce(c.source_id,'')=? AND julianday(c.context_at)>=julianday(?) AND julianday(c.context_at)<julianday(?)",[record.deviceId,record.source,record.appId??'',record.windowTitle??'',record.provenance?.sourceId??'',new Date(start).toISOString(),new Date(start+300000).toISOString()],{ascending:true});},
    uiPageGroup:()=>group.captureId?{records:[permit(record)!],truncated:false}:sameGroup(2000,"json_extract(c.json,'$.source')='ui_page' AND json_extract(c.json,'$.metadata.uiPage.version')=2 AND json_extract(c.json,'$.appId')=? AND json_extract(c.json,'$.metadata.uiPage.objects[0].kind')=? AND json_extract(c.json,'$.metadata.uiPage.objects[0].identity.type')=? AND json_extract(c.json,'$.metadata.uiPage.objects[0].identity.value')=?",[group.appId,group.kind,group.identityType,group.identityValue],{pageBudget:true}),
    file:id=>allowed.has(id)?this.file(data,id):undefined};
   const draft=organizer.build(reader,group);if(!draft)continue;
   // M03 owns transport source identity. Builder-local source naming cannot
   // switch the host grant or manufacture another source's authorization.
   draft.origin.sourceId=source.id;draft.id='mat_'+memoryHash([source.id,draft.origin.externalId]);
   const prior=data.sql.get('SELECT revision FROM pd_materials WHERE user_id=$user AND id=?',draft.id);if(prior&&data.privateData.material(draft.id).kind!==draft.kind)continue;
   const material=data.privateData.publishMaterial(draft,prior?String(prior.revision):undefined);run.grant.assert();this.published(run,material);
  }
 }
 private project(data:ScopedMemoryData,record:CaptureRecord){const file=this.file(data,record.id),ocr=file.image?.products.find(product=>product.kind==='ocr');return ocr?{...record,ocrText:ocr.text??'',ocr:{status:'completed' as const}}:file.image?{...record,ocr:{status:file.image.jobs.find(job=>job.name==='ocr')?.state==='failed'?'failed' as const:'pending' as const}}:record;}
 private file(data:ScopedMemoryData,id:string):MaterialOrganizerFile{
  const original=data.sql.get('SELECT id,hash,mime,retention FROM ig_originals WHERE user_id=$user AND capture_id=?',id),artifact=original?data.sql.get('SELECT a.id,a.json FROM mp_artifacts a JOIN mp_publications p ON p.user_id=a.user_id AND p.artifact_id=a.id WHERE a.user_id=$user AND p.user_id=$user AND a.original_id=? AND a.complete=1',original.id):undefined,transcript=artifact?transcriptSchema.parse(JSON.parse(String(artifact.json))):undefined;
  const chunks=transcript?.segments.map((segment,index)=>({id:'segment-'+index,text:segment.text,startMs:segment.startMs??null,endMs:segment.endMs??null,kind:'text',...(segment.speaker?{speaker:segment.speaker}:{}),...(segment.imageLocation?{imageLocation:segment.imageLocation}:{}),artifact:{complete:transcript.coverage!=='partial',coverage:transcript.coverage}}))??[];
  if(!original||!String(original.mime).startsWith('image/'))return {attachments:[],attachmentsTruncated:false,chunks,processingRequired:Boolean(original),extraction:transcript?{complete:transcript.coverage!=='partial',coverage:transcript.coverage}:undefined};
  const admission=data.sql.get('SELECT e.input,e.state FROM mp_admissions a JOIN execution_steps e ON e.user_id=a.user_id AND e.id=a.task_id WHERE a.user_id=$user AND e.user_id=$user AND a.original_id=? ORDER BY e.created_at DESC LIMIT 1',original.id),settings=admission?JSON.parse(String(admission.input)).settings:JSON.parse(String(data.sql.get('SELECT settings FROM mp_state WHERE user_id=$user')?.settings??'{}'));
  const state=(name:'ocr'|'understanding',ready:boolean):'ready'|'pending'|'failed'|'unavailable'=>{if(ready)return 'ready';if(original.retention==='archive'||settings.enabled===false||!admission&&settings.automatic===false)return 'unavailable';const row=data.sql.get("SELECT state FROM execution_steps WHERE user_id=$user AND json_extract(input,'$.originalRef')=? AND (kind=? OR(kind='processing.analysis' AND json_extract(input,'$.mode')=?)) ORDER BY created_at DESC LIMIT 1",'original:'+original.id,name==='ocr'?'processing.ocr':'processing.analysis',name==='ocr'?'ocr':'image'),value=String(row?.state??admission?.state??'waiting');return ['failed','blocked'].includes(value)?'failed':['stale','cancelled'].includes(value)?'unavailable':'pending';};
  const derived=data.sql.get("SELECT a.id,a.json FROM mp_artifacts a JOIN mp_derivations d ON d.user_id=a.user_id AND d.artifact_id=a.id JOIN pd_materials m ON m.user_id=d.user_id AND m.id=d.material_id AND m.revision=d.revision WHERE a.user_id=$user AND d.user_id=$user AND m.user_id=$user AND a.original_id=? AND d.kind='image' AND a.complete=1",original.id),interpretation=derived?transcriptSchema.parse(JSON.parse(String(derived.json))):undefined;
  const products=[...(artifact?[{name:'ocr',kind:'ocr',revision:String(artifact.id),text:transcript!.segments.map(segment=>segment.text).join('\n')}]:[]),...(derived?[{name:'understanding',kind:'understanding',revision:String(derived.id),text:interpretation!.segments.map(segment=>segment.text).join('\n'),evidence:{originalHash:String(original.hash)}}]:[])];
  return {attachments:[],attachmentsTruncated:false,chunks,image:{archiveOnly:original.retention==='archive',original:{captureId:id,sha256:String(original.hash)},products,jobs:[{name:'ocr',state:state('ocr',Boolean(artifact))},...(settings?.understandingEnabled?[{name:'understanding',state:state('understanding',Boolean(derived))}]:[])]}};
 }
 async close(){for(const dispose of this.disposers.reverse())await dispose();}
}
