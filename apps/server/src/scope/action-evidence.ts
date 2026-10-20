import {actionEvidenceText,transcriptSchema,unknownAttributionContext,type CaptureRecord} from '@mote/shared';
import type {ContextRange} from '@mote/agent';
import {withinEvidenceScope} from '../evidence-range.js';
import {memoryEvidenceFingerprint} from '../memory-contract.js';
import {AskEvidence} from './ask-evidence.js';
import type {PrivateData} from './private-data.js';
import {PrivateSql,PrivateCursor,missing} from './private-data-sql.js';
import type {AskScope,EvidencePin,MaterialPin} from './ask-schema.js';

/** The Actions archive reader preserves canonical observation IDs. Ask's
 * query-visible projection remains unchanged. The model still receives only
 * the exact host-selected extraction IDs/ranges through its read-only bridge. */
export class ActionEvidence extends AskEvidence{
 constructor(private actionSql:PrivateSql,private actionData:PrivateData,cursor:PrivateCursor,private actionScope:AskScope,private actionObserve:(pins:EvidencePin[],materials:MaterialPin[])=>void=()=>{}){super(actionSql,actionData,cursor,actionScope,actionObserve);}
 override evidence(ids:readonly string[],range:ContextRange&{sourceId?:string}={}):CaptureRecord[]{
  return [...new Set(ids)].map(id=>{
   this.actionScope.assertCurrent();
   if(!this.actionSql.get('SELECT 1 FROM pd_captures WHERE user_id=$user AND id=?',id))return super.evidence([id],range)[0]!;
   const original=this.actionData.capture(id),sourceId=original.provenance?.sourceId??this.actionSql.get('SELECT source_id FROM ig_capture_scopes WHERE user_id=$user AND capture_id=?',id)?.source_id;
   if(typeof sourceId!=='string'||this.actionScope.sourceIds&&!this.actionScope.sourceIds.includes(sourceId))throw missing();
   const source=this.actionData.source(sourceId),p=original.provenance;
   if(!source.enabled||source.retention==='reference'||source.retention==='archive'||source.kind==='coding-agent'||original.privacy.excluded||original.privacy.redacted||p&&(p.deleted||p.layer==='reference'||this.actionData.sourceItem(sourceId,p.externalId)?.captureId!==id))throw missing();
   if(range.sourceId&&range.sourceId!==sourceId||!withinEvidenceScope(original,{...range,sourceId:undefined}))throw missing();
   const artifact=this.actionSql.get('SELECT a.json FROM ig_originals o JOIN mp_publications p ON p.user_id=o.user_id AND p.original_id=o.id JOIN mp_artifacts a ON a.user_id=p.user_id AND a.id=p.artifact_id WHERE o.user_id=$user AND p.user_id=$user AND a.user_id=$user AND o.capture_id=? AND a.complete=1',id);
   const ocr=original.source==='screen'&&artifact?transcriptSchema.parse(JSON.parse(String(artifact.json))).segments.map(segment=>segment.text).join('\n'):undefined;
   const context=this.actionData.sourceContext(sourceId),attributionContext={...unknownAttributionContext(),...original.attributionContext,...(source.ownerRelation?{ownerRelation:source.ownerRelation,basis:'owner_source' as const}:{}),...(source.ownerRelationVersion?{sourceDeclaration:{sourceId,version:source.ownerRelationVersion,ownerRelation:source.ownerRelation??null}}:{}),...(context.fingerprint?{sourceContextDeclarations:[{sourceId,version:context.version,fingerprint:context.fingerprint}],sourceContextStatements:[{sourceId,version:context.version,description:context.description}]}:{})};
   const record={...original,attributionContext,ocrText:ocr??actionEvidenceText(original),...(ocr!==undefined?{ocr:{status:'completed' as const}}:{})},incarnation=this.actionSql.get('SELECT incarnation FROM ma_sources WHERE user_id=$user AND id=?',sourceId)?.incarnation;
   if(!incarnation)throw missing();
   this.actionObserve([{id,hash:memoryEvidenceFingerprint(record),receipt:this.originalReceipt(id),source:{id:sourceId,incarnation:String(incarnation)}}],[]);
   return record;
  });
 }
}
