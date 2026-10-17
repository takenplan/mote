import {EXECUTION_POLICIES} from './execution-policy.js';
import {codingProjectContext} from './coding-project.js';
import {uiPageCaptureSource} from './capture-memory-source.js';
import {DAILY_EVENT_RECIPE} from './daily-event-memory-policy.js';
import {createHash} from 'node:crypto';
import {sourceContentTime,imageLocationSchema,type CaptureRecord,type Transcript,type UiContentObject} from '@mote/shared';
import {materialId,MaterialStore,type MaterialDraft,type MaterialEvidenceContext} from './materials.js';
import {ArchivedFileStore} from './archived-files.js';
import type {Store} from './store.js';
import {ExecutionEngine,ExecutionFailure,type ExecutionStep} from './execution-engine.js';
import {CaptureRawReader,captureRawRef} from './capture-raw-reader.js';
import {SourceItemRecipeCatalog,type SourceItemRecipePin} from './source-item-recipe.js';
import type {MaterialMemoryWork} from './material-memory-work.js';
import {readFileSpeakerAttributions} from './file-speaker-attribution.js';
import {fileAttachmentAvailable,fileAttachmentChildren,fileAttachmentParent} from './file-attachments.js';
import {imageMaterialProjection,type ImageMaterialProjection} from './image-materials.js';
import {linkOperation} from './operation-projection.js';

import {MaterialOrganizerRegistry,authoredRecordProjection,digest,canonicalGroup,MAX_BLOCKS,sourceItem,codingSession,uiPageObject,screenGroup,captureEvent,stateSeries,authored,type MaterialOrganizer,type MaterialOrganizerReader,type MaterialOrganizerFile} from './material-organizer-contract.js';
export {MaterialOrganizerRegistry,authoredRecordProjection} from './material-organizer-contract.js';
export type {MaterialOrganizer,MaterialOrganizerReader,MaterialOrganizerFile} from './material-organizer-contract.js';
const MAX_MEMBERS=2000,MAX_TEXT=4_000_000;
const capture=(store:Store,id:string)=>store.evidence([id])[0];
const current=(store:Store,id:string)=>store.isCurrentEvidence(id);
const uiPageObservation=(r:CaptureRecord)=>{
 const page=r.metadata?.uiPage;if(page?.version!==2)throw Error('Expected structured page evidence');
 return {captureId:r.id,appVersion:page.appVersion,adapterId:page.adapterId,adapterVersion:page.adapterVersion,activity:page.activity,status:page.status,truncated:page.truncated,...page.observations};
};
function organizerReader(store:Store,selection:Record<string,string>,pinnedSourceHead?:CaptureRecord):MaterialOrganizerReader {
  const group={...selection},allowed=new Set<string>();
  const permit=(record:CaptureRecord|undefined)=>{
    if(record&&current(store,record.id)){allowed.add(record.id);return record;}
    return undefined;
  };
  const sourceHead=()=>{
    if(!group.sourceId||!group.externalId)return;
    const row=store.db.prepare('SELECT capture_id,deleted FROM source_heads WHERE source_id=? AND external_id=?').get(group.sourceId,group.externalId) as {capture_id:string;deleted:number}|undefined;
    return row&&!row.deleted&&(pinnedSourceHead===undefined||row.capture_id===pinnedSourceHead.id)?permit(pinnedSourceHead??capture(store,row.capture_id)):undefined;
  };
  const codingSession=()=>{
    if(!group.sourceId||!group.provider||!group.projectKey||!group.sessionId)return {records:[],truncated:false};
    const rows=store.db.prepare(`SELECT c.id FROM captures c JOIN source_heads h ON h.capture_id=c.id
      WHERE h.source_id=? AND h.deleted=0 AND json_extract(c.json,'$.provenance.document.coding.provider')=?
      AND json_extract(c.json,'$.provenance.document.coding.projectKey')=?
      AND json_extract(c.json,'$.provenance.document.coding.sessionId')=?
      ORDER BY c.captured_at DESC,c.id DESC LIMIT 2001`).all(group.sourceId,group.provider,group.projectKey,group.sessionId) as {id:string}[];
    return {records:rows.slice(0,MAX_MEMBERS).map(row=>permit(capture(store,row.id))).filter((r):r is CaptureRecord=>Boolean(r)),truncated:rows.length>MAX_MEMBERS};
  };
  const screenGroup=()=>{
    if(!group.groupKey||!group.deviceId)return {records:[],truncated:false};
    const rows=store.db.prepare(`SELECT o.id FROM context_observations o JOIN captures c ON c.id=o.id
      WHERE o.group_key=? AND c.device_id=?
      AND (json_extract(c.json,'$.source')='screen' OR (json_extract(c.json,'$.source')='ui_page' AND json_extract(c.json,'$.metadata.uiPage.version')=1))
      ORDER BY c.captured_at,o.id LIMIT 1001`).all(group.groupKey,group.deviceId) as {id:string}[];
    return {records:rows.slice(0,1000).map(row=>permit(capture(store,row.id))).filter((r):r is CaptureRecord=>Boolean(r)),truncated:rows.length>1000};
  };
  const uiPageGroup=()=>{
    if(group.captureId)return {records:[permit(capture(store,group.captureId))].filter((r):r is CaptureRecord=>Boolean(r)),truncated:false};
    if(!group.deviceId||!group.appId||!group.kind||!group.identityType||!group.identityValue)return {records:[],truncated:false};
    const rows=store.db.prepare(`SELECT id FROM captures WHERE device_id=?
      AND json_extract(json,'$.source')='ui_page' AND json_extract(json,'$.metadata.uiPage.version')=2
      AND json_extract(json,'$.appId')=? AND json_extract(json,'$.metadata.uiPage.objects[0].kind')=?
      AND json_extract(json,'$.metadata.uiPage.objects[0].identity.type')=?
      AND json_extract(json,'$.metadata.uiPage.objects[0].identity.value')=?
      ORDER BY captured_at DESC,id DESC LIMIT 2001`).all(group.deviceId,group.appId,group.kind,group.identityType,group.identityValue) as {id:string}[];
    const records:CaptureRecord[]=[];
    let characters=2,truncated=rows.length>MAX_MEMBERS;
    // Parse newest originals one at a time. The existing Material text budget
    // bounds retained field text and observation metadata before grouping copies.
    for(const row of rows.slice(0,MAX_MEMBERS)){
      const record=capture(store,row.id);if(!record||!current(store,record.id))continue;
      const page=record.metadata?.uiPage;if(page?.version!==2)continue;
      const {body:paragraphs,identity:_,...fields}=page.objects[0]!;
      const cost=JSON.stringify(fields).length+paragraphs.reduce((sum,p)=>sum+p.text.length,0)+JSON.stringify(uiPageObservation(record)).length+1;
      if(characters+cost>MAX_TEXT){truncated=true;break;}
      characters+=cost;records.push(permit(record)!);
    }
    return {records,truncated};
  };
  const file=(captureId:string,includeAttached=true):MaterialOrganizerFile|undefined=>{
    if(!allowed.has(captureId))return;
    const original=store.db.prepare('SELECT object_hash FROM file_versions WHERE capture_id=?').get(captureId) as {object_hash:string|null}|undefined;
    const attachmentRows=store.db.prepare('SELECT f.id,f.hash,f.json FROM capture_files c JOIN archived_files f ON f.id=c.file_id WHERE c.capture_id=? ORDER BY f.id LIMIT 2001').all(captureId) as {id:string;hash:string;json:string}[];
    const providerTranscript=Boolean(store.db.prepare("SELECT 1 FROM file_artifacts WHERE capture_id=? AND kind='transcript' AND current=1 AND json_extract(json,'$.providerSupplied')=1").get(captureId));
    const chunkLimit=providerTranscript?19991:2001;
    const chunkRows=store.db.prepare(`SELECT c.id,c.artifact_id,c.text,c.metadata,c.start_ms,c.end_ms,a.kind FROM file_chunks c JOIN file_artifacts a ON a.id=c.artifact_id
      WHERE c.capture_id=? AND a.current=1 AND a.kind IN ('text','image-text','transcript','dialogue','corrected-dialogue')
      AND NOT EXISTS(SELECT 1 FROM file_artifacts preferred WHERE preferred.capture_id=a.capture_id AND preferred.current=1
        AND ((preferred.kind='corrected-dialogue' AND a.kind!='corrected-dialogue')
          OR (preferred.kind='dialogue' AND a.kind IN ('transcript','text','image-text'))))
      ORDER BY c.start_ms,c.ordinal,c.rowid LIMIT ${chunkLimit}`).all(captureId) as {id:string;artifact_id:string;text:string;metadata:string|null;start_ms:number|null;end_ms:number|null;kind:string}[];
    const confirmations=new Map([...new Set(chunkRows.map(row=>row.artifact_id))].map(id=>[id,readFileSpeakerAttributions(store,captureId,id)]));
    // A transcript artifact contains the complete segment array. Project its
    // coverage once instead of copying that array into every segment, which
    // would make long recordings quadratic in memory and fingerprint size.
    const artifactCoverage=new Map<string,{complete?:boolean;coverage?:string}>();
    for(const row of chunkRows)if(!artifactCoverage.has(row.artifact_id)){
      const artifact=JSON.parse((store.db.prepare('SELECT json FROM file_artifacts WHERE id=?').get(row.artifact_id) as {json:string}).json) as {complete?:boolean;coverage?:string};
      artifactCoverage.set(row.artifact_id,{complete:artifact.complete,coverage:artifact.coverage});
    }
    const job=store.db.prepare('SELECT state,error FROM file_jobs WHERE capture_id=?').get(captureId) as {state:string;error:string|null}|undefined;
    const attachedFiles=includeAttached?fileAttachmentChildren(store,captureId).flatMap(({record,fileId})=>{
      permit(record);const selected=file(record.id,false);return selected?[{fileId,record,file:selected}]:[];
    }):[];
    const extraction=store.db.prepare("SELECT json FROM file_artifacts WHERE capture_id=? AND current=1 AND kind IN ('text','image-text','transcript','dialogue','corrected-dialogue') ORDER BY rowid DESC LIMIT 1").get(captureId);
    const extracted=extraction?JSON.parse(String(extraction.json)):undefined;
    return {image:imageMaterialProjection(store,captureId),extraction:extracted?{complete:extracted.complete,coverage:extracted.coverage}:undefined,processingRequired:!!original,providerTranscript,objectHash:original?.object_hash??undefined,...(attachedFiles.length?{attachedFiles}:{}),
      attachments:attachmentRows.slice(0,2000).map(row=>{
        const metadata=JSON.parse(row.json) as {mimeType?:string;relativePath?:string};
        return {id:row.id,hash:row.hash,mimeType:metadata.mimeType??'application/octet-stream',...(metadata.relativePath?{relativePath:metadata.relativePath}:{})};
      }),
      chunks:chunkRows.map(row=>{
        const metadata=JSON.parse(row.metadata??'{}'),speaker=typeof metadata.speaker==='string'?metadata.speaker:undefined;
        const speakerAttribution=speaker?confirmations.get(row.artifact_id)?.[speaker]:undefined;
        return {id:row.id,text:row.text,startMs:row.start_ms,endMs:row.end_ms,kind:row.kind,
          ...(speaker?{speaker}:{}),...(speakerAttribution?{speakerAttribution}:{}),
          ...(metadata.imageLocation?{imageLocation:imageLocationSchema.parse(metadata.imageLocation)}:{}),
          artifact:artifactCoverage.get(row.artifact_id)!};
      }),job,
      attachmentsTruncated:attachmentRows.length>2000};
  };
  return Object.freeze({capture:()=>group.captureId?permit(capture(store,group.captureId)):undefined,sourceHead,codingSession,screenGroup,uiPageGroup,file});
}

type ReaderCall={method:'capture'|'sourceHead'|'codingSession'|'screenGroup'|'uiPageGroup'|'file';captureId?:string;fingerprint:string};
function recordingReader(store:Store,group:Record<string,string>,pinnedSourceHead?:CaptureRecord){
  const base=organizerReader(store,group,pinnedSourceHead),calls:ReaderCall[]=[];
  const record=<T>(method:ReaderCall['method'],value:T,captureId?:string)=>{
    calls.push({method,...(captureId?{captureId}:{}),fingerprint:digest([value])});return value;
  };
  const reader:MaterialOrganizerReader=Object.freeze({
    capture:()=>record('capture',base.capture()),sourceHead:()=>record('sourceHead',base.sourceHead()),
    codingSession:()=>record('codingSession',base.codingSession()),screenGroup:()=>record('screenGroup',base.screenGroup()),
    uiPageGroup:()=>record('uiPageGroup',base.uiPageGroup()),
    file:(id:string)=>record('file',base.file(id),id),
  });
  return {reader,calls};
}
function readerStillCurrent(store:Store,group:Record<string,string>,calls:readonly ReaderCall[]){
  const reader=organizerReader(store,group);
  for(const call of calls){
    const value=call.method==='file'?reader.file(call.captureId!):reader[call.method]();
    if(digest([value])!==call.fingerprint)return false;
  }
  return true;
}

type OrganizerJobInput=Record<string,unknown>&{groupKey:string;organizerId:string;version:string;group:Record<string,string>;materialId:string;generation:number;checkpoint:number;active:boolean;sourceChanged?:boolean;recipe?:SourceItemRecipePin};
type OrganizerResult={draft:MaterialDraft|undefined;calls:ReaderCall[];pinnedSourceHead?:string};
type OrganizerGroupRow={group_key:string;organizer_id:string;version:string;group_json:string;material_id:string;generation:number;checkpoint:number;active:number};
const ORGANIZER_STEP='material.organizer';

/** Cursors discover work; the shared execution engine alone commits materials. */
export class MaterialOrganizerRuntime {
  readonly registry:MaterialOrganizerRegistry;
  readonly executor:ExecutionEngine;
  readonly sourceItemRecipes:SourceItemRecipeCatalog;
  private readonly failures=new Map<string,unknown>();
  private running=false;
  private closed=false;
  private unregister:()=>Promise<void>;
  constructor(private readonly store:Store,readonly materials:MaterialStore,additionalOrganizers:MaterialOrganizer[]=[],executor?:ExecutionEngine,private readonly memoryWork?:MaterialMemoryWork){
    new ArchivedFileStore(store);
    store.db.exec(`CREATE TABLE IF NOT EXISTS material_organizer_inputs(capture_id TEXT NOT NULL,organizer_id TEXT NOT NULL,group_json TEXT NOT NULL,material_id TEXT,PRIMARY KEY(capture_id,organizer_id));
      CREATE TABLE IF NOT EXISTS material_organizer_backfills(organizer_id TEXT PRIMARY KEY,version TEXT NOT NULL,cursor_rowid INTEGER NOT NULL DEFAULT 0,complete INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS material_organizer_groups(group_key TEXT PRIMARY KEY,organizer_id TEXT NOT NULL,version TEXT NOT NULL,group_json TEXT NOT NULL,material_id TEXT NOT NULL,generation INTEGER NOT NULL,checkpoint INTEGER NOT NULL,active INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS material_organizer_group_material ON material_organizer_groups(material_id,active);
      CREATE TRIGGER IF NOT EXISTS material_capture_json_change AFTER UPDATE OF json ON captures WHEN new.json!=old.json BEGIN
        INSERT INTO changes(id,operation,changed_at) VALUES(new.id,'upsert',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      END;
      CREATE TRIGGER IF NOT EXISTS material_attachment_add AFTER INSERT ON capture_files BEGIN
        INSERT INTO changes(id,operation,changed_at) VALUES(new.capture_id,'upsert',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      END;
      CREATE TRIGGER IF NOT EXISTS material_attachment_remove AFTER DELETE ON capture_files BEGIN
        INSERT INTO changes(id,operation,changed_at) VALUES(old.capture_id,'supersede',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      END;
      CREATE TRIGGER IF NOT EXISTS material_file_job_change AFTER UPDATE OF state ON file_jobs WHEN new.state!=old.state BEGIN
        INSERT INTO changes(id,operation,changed_at) VALUES(new.capture_id,'upsert',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      END;
      CREATE TRIGGER IF NOT EXISTS material_file_artifact_add AFTER INSERT ON file_artifacts BEGIN
        INSERT INTO changes(id,operation,changed_at) VALUES(new.capture_id,'upsert',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      END;
      CREATE TRIGGER IF NOT EXISTS material_file_artifact_change AFTER UPDATE OF current,json ON file_artifacts WHEN new.current!=old.current OR new.json!=old.json BEGIN
        INSERT INTO changes(id,operation,changed_at) VALUES(new.capture_id,'upsert',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      END;
      CREATE TRIGGER IF NOT EXISTS material_file_chunk_add AFTER INSERT ON file_chunks BEGIN
        INSERT INTO changes(id,operation,changed_at) VALUES(new.capture_id,'upsert',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      END;
      CREATE TRIGGER IF NOT EXISTS material_file_chunk_change AFTER UPDATE OF text,start_ms,end_ms,artifact_id,metadata ON file_chunks BEGIN
        INSERT INTO changes(id,operation,changed_at) VALUES(new.capture_id,'upsert',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      END;
      CREATE TRIGGER IF NOT EXISTS material_file_chunk_remove AFTER DELETE ON file_chunks BEGIN
        INSERT INTO changes(id,operation,changed_at) VALUES(old.capture_id,'supersede',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
      END;`);
    // Installation may find an existing archive. Rebuild it deterministically
    // through backfill; only changes after installation count as new intake.
    store.db.prepare("INSERT OR IGNORE INTO settings(key,value) SELECT 'material-organizer-cursor',CAST(coalesce(max(seq),0) AS TEXT) FROM changes").run();
    this.sourceItemRecipes=new SourceItemRecipeCatalog(store,sourceItem.version);
    this.executor=executor??new ExecutionEngine(store);
    materials.bindIndexEngine(this.executor);
    this.unregister=this.executor.register({kind:ORGANIZER_STEP,pool:'material-organizer',concurrency:()=>8,policy:EXECUTION_POLICIES.deterministic,timeoutMs:900000,
      resourceKeys:step=>[`material:${(step.input as OrganizerJobInput).materialId}`],
      validate:step=>!this.closed&&this.valid(step),
      execute:async(step,signal)=>{try{
        signal.throwIfAborted();const input=step.input as OrganizerJobInput;
        if(!input.active)return {draft:undefined,calls:[]} satisfies OrganizerResult;
        const organizer=this.registry.get(input.organizerId);
        if(!organizer||organizer.version!==input.version)throw new ExecutionFailure('stale','organizer_changed');
        const pinnedSourceHead=input.group.sourceId&&input.group.externalId?
          await this.readSourceHead(input.group.sourceId,input.group.externalId,signal):undefined;
        const {reader,calls}=recordingReader(store,input.group,pinnedSourceHead),draft=organizer.build(reader,input.group);
        signal.throwIfAborted();
        if(draft&&draft.id!==input.materialId)throw Error('Ambiguous material organizer identity');
        return {draft,calls,...(pinnedSourceHead?{pinnedSourceHead:pinnedSourceHead.id}:{})} satisfies OrganizerResult;
      }catch(error){this.failures.set(step.id,error);throw error;}},
      commit:(step,result)=>{try{
        const input=step.input as OrganizerJobInput,prepared=result as OrganizerResult;
        if(this.closed||!this.valid(step)||!readerStillCurrent(store,input.group,prepared.calls))throw new ExecutionFailure('stale','input_changed');
        if(prepared.pinnedSourceHead&&input.group.sourceId&&input.group.externalId){
          const raw=new CaptureRawReader(store,{mayReadSource:id=>id===input.group.sourceId,
            mayReadGroup:(id,external)=>id===input.group.sourceId&&external===input.group.externalId,mayListKind:()=>false});
          if(raw.currentRefForItem(input.group.sourceId,input.group.externalId)!==captureRawRef(prepared.pinnedSourceHead))
            throw new ExecutionFailure('stale','source_head_changed');
        }
        const other=store.db.prepare('SELECT 1 FROM material_organizer_groups WHERE material_id=? AND group_key!=? AND active=1 LIMIT 1').get(input.materialId,input.groupKey);
        if(input.active&&other)throw Error('Ambiguous material organizer identity');
        if(prepared.draft){
          const prior=materials.get(input.materialId);
          if(!prior&&(store.db.prepare('SELECT retired FROM material_heads WHERE id=?').get(input.materialId) as {retired:number}|undefined)?.retired)materials.forget(input.materialId);
          materials.publish(prepared.draft,{expectedRevision:prior?.revision??null,processingStateTransition:input.organizerId===sourceItem.id});
          materials.setSearchable(input.materialId,true);
          if(input.organizerId===sourceItem.id){
            const artifacts=prepared.draft.artifacts??[],image=artifacts.some(item=>item.key==='image-original');
            const required=image?['image-original',...artifacts.filter(item=>item.key==='extracted-text'&&item.state==='ready'&&item.blockIds?.length).map(item=>item.key)]:[artifacts.some(item=>item.key==='original')?'extracted-text':'source-body'];
            const attachments=artifacts.filter(item=>item.key.startsWith('attachment/')&&(item.key.endsWith('/original-image')||item.key.endsWith('/text')&&item.state==='ready'&&item.blockIds?.length)).map(item=>item.key);
            const selected=prepared.pinnedSourceHead?this.claimedImageRequirements(input.materialId,prepared.pinnedSourceHead,[...required,...attachments]):[...required,...attachments];
            const activity=Boolean(prepared.pinnedSourceHead&&capture(store,prepared.pinnedSourceHead)?.provenance?.document?.activity);
            if(prepared.pinnedSourceHead)this.memoryWork?.observe(input.materialId,activity?['daily-events']:selected,{
              inputKey:prepared.pinnedSourceHead,change:input.sourceChanged?'source':'rebuild',
              ...(activity?{recipeIds:[DAILY_EVENT_RECIPE.id]}:{excludeRecipeIds:[DAILY_EVENT_RECIPE.id]}),
            });
          }else if(input.organizerId===uiPageObject.id){
            const last=prepared.draft.members.at(-1)?.id;
            if(last)this.memoryWork?.observe(input.materialId,['source-body'],{inputKey:last,change:input.sourceChanged?'source':'rebuild',excludeRecipeIds:[DAILY_EVENT_RECIPE.id]},15000);
          }else if(input.organizerId===screenGroup.id){
            const last=prepared.draft.members.at(-1)?.id;
            if(last)this.memoryWork?.observe(input.materialId,this.claimedImageRequirements(input.materialId,last,prepared.draft.artifacts?.some(item=>item.key==='image-original')?['image-original',...(prepared.draft.artifacts?.some(item=>item.key==='image-ocr')?['image-ocr']:[])]:['ocr']),{inputKey:last,change:input.sourceChanged?'source':'rebuild',excludeRecipeIds:[DAILY_EVENT_RECIPE.id]},15000);
          }else if(input.organizerId===captureEvent.id){
            this.memoryWork?.observe(input.materialId,['daily-events'],{inputKey:input.group.captureId,change:input.sourceChanged?'source':'rebuild',recipeIds:[DAILY_EVENT_RECIPE.id]},15000);
          }
        }else if(!other){
          const prior=materials.get(input.materialId);if(prior)materials.retire(input.materialId,{expectedRevision:prior.revision});
          this.memoryWork?.withdraw(input.materialId);
        }
      }catch(error){this.failures.set(step.id,error);throw error;}},
      classify:error=>error instanceof ExecutionFailure?error:new ExecutionFailure('permanent','organizer_failed'),
    });
    this.registry=new MaterialOrganizerRegistry(organizer=>{
      const fresh=this.cursor()===0;
      store.db.prepare(`INSERT INTO material_organizer_backfills(organizer_id,version,cursor_rowid,complete) VALUES(?,?,0,?)
        ON CONFLICT(organizer_id) DO UPDATE SET version=excluded.version,
          cursor_rowid=CASE WHEN version=excluded.version THEN cursor_rowid ELSE 0 END,
          complete=CASE WHEN version=excluded.version THEN complete ELSE excluded.complete END`).run(organizer.id,organizer.version,fresh?1:0);
      // Registration and startup only discover work. Terminal failures require
      // explicit retry or a new source/component generation.
    });
    for(const organizer of [sourceItem,codingSession,uiPageObject,screenGroup,captureEvent,stateSeries,authored])this.registry.register(organizer);
    for(const organizer of additionalOrganizers)this.registry.register(organizer);
    this.reconcileOperationGenerations();
  }
  /** Optional late OCR/vision cannot replace the frozen targets of already
   * admitted work or spend a consumed raw-input grant. A new revision or an
   * explicit manual selection can choose the newly ready image outputs. */
  private claimedImageRequirements(materialId:string,inputKey:string,proposed:string[]):string[]{
    if(!this.memoryWork||!proposed.some(key=>key==='image-original'||key.endsWith('/original-image')))return proposed;
    const prior=this.store.db.prepare('SELECT source_required_json FROM material_memory_requests WHERE material_id=? AND input_key=? AND job_id IS NOT NULL ORDER BY rowid LIMIT 1').get(materialId,inputKey);
    return prior?JSON.parse(String(prior.source_required_json)):proposed;
  }
  private reconcileOperationGenerations(){
    // Older organizers linked every generation as current. Repair only the
    // read model from the saved current groups; never retry historical work.
    const db=this.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');
    try{
      for(const row of db.prepare('SELECT group_key,generation FROM material_organizer_groups').all()){
        const key=String(row.group_key),generation=Number(row.generation),id=digest([ORGANIZER_STEP,key,generation]);
        if(!this.executor.get(id))continue;
        const operationId=`material-organizer:${key}`;
        db.prepare("UPDATE execution_operation_steps SET active=0 WHERE operation_id=? AND slot='' AND active=1").run(operationId);
        linkOperation(this.store,operationId,id,{generation:{slot:'organize',version:String(generation)}});
      }
      if(own)db.exec('COMMIT');
    }catch(error){if(own)db.exec('ROLLBACK');throw error;}
  }
  private cursor(){return Number(this.store.db.prepare("SELECT value FROM settings WHERE key='material-organizer-cursor'").get()?.value??0);}
  private selectedFor(captureId:string){
    const record=capture(this.store,captureId);
    if(!record||!current(this.store,record.id)||!fileAttachmentAvailable(this.store,record.id))return [];
    return this.registry.select(record).map(({organizer,group})=>{
      if(organizer===screenGroup){const row=this.store.db.prepare('SELECT group_key FROM context_observations WHERE id=?').get(record.id) as {group_key:string}|undefined;group.groupKey=row?.group_key??'';}
      if(organizer===sourceItem){const parent=fileAttachmentParent(this.store,record.id)?.record.provenance;if(parent)group={sourceId:parent.sourceId,externalId:parent.externalId};}
      return {organizer,group:canonicalGroup(group)};
    });
  }
  private async readSourceHead(sourceId:string,externalId:string,signal:AbortSignal){
    const raw=new CaptureRawReader(this.store,{
      mayReadSource:id=>id===sourceId,
      mayReadGroup:(id,external)=>id===sourceId&&external===externalId,
      mayListKind:()=>false,
    });
    signal.throwIfAborted();
    const snapshot=raw.snapshotForItem(sourceId,externalId);
    if(!snapshot)throw new ExecutionFailure('stale','source_head_unavailable');
    return snapshot.capture;
  }

  private retryReadyRetirements(){
    const ids:string[]=[];
    for(const row of this.store.db.prepare(`SELECT e.id FROM execution_steps e WHERE e.kind=? AND e.state='blocked' AND e.error='dependency_failed'
      AND NOT EXISTS(SELECT 1 FROM execution_dependencies d JOIN execution_steps parent ON parent.id=d.dependency_id
        WHERE d.step_id=e.id AND parent.state!='succeeded')`).all(ORGANIZER_STEP) as {id:string}[]){
      const step=this.executor.get(row.id),input=step?.input as OrganizerJobInput|undefined;
      if(step&&input&&!input.active&&this.valid(step)){this.failures.delete(row.id);this.executor.retry(row.id);ids.push(row.id);}
    }
    return ids;
  }
  private valid(step:ExecutionStep){
    const input=step.input as OrganizerJobInput,db=this.store.db;
    if(!input||!input.groupKey||!input.materialId||!Number.isSafeInteger(input.generation)||!Number.isSafeInteger(input.checkpoint))return false;
    const row=db.prepare('SELECT * FROM material_organizer_groups WHERE group_key=?').get(input.groupKey) as OrganizerGroupRow|undefined;
    if(!row||row.organizer_id!==input.organizerId||row.version!==input.version||row.group_json!==JSON.stringify(input.group)||
      row.material_id!==input.materialId||row.generation!==input.generation||row.checkpoint!==input.checkpoint||Boolean(row.active)!==input.active)return false;
    const organizer=this.registry.get(input.organizerId);
    if(input.active&&(!organizer||organizer.version!==input.version||organizer.identity(input.group)!==input.materialId))return false;
    if(input.active&&input.organizerId===sourceItem.id){
      if(!input.group.sourceId||!input.recipe)return false;
      try{
        const pin=this.sourceItemRecipes.resolveForSourceId(input.group.sourceId);
        if(pin.recipeId!==input.recipe.recipeId||pin.version!==input.recipe.version||pin.sourceKind!==input.recipe.sourceKind||
          pin.definitionFingerprint!==input.recipe.definitionFingerprint||pin.configFingerprint!==input.recipe.configFingerprint)return false;
      }catch{return false;}
    }
    const mapped=db.prepare('SELECT capture_id FROM material_organizer_inputs WHERE organizer_id=? AND group_json=?').all(input.organizerId,row.group_json) as {capture_id:string}[];
    let selected=0;
    for(const {capture_id:id} of mapped){
      const matches=this.selectedFor(id).some(value=>value.organizer.id===input.organizerId&&JSON.stringify(value.group)===row.group_json);
      if(matches)selected++;else return false;
    }
    if(Boolean(selected)!==input.active)return false;
    // A new capture, tombstone or file artifact may arrive before discovery.
    // Reject only changes that could alter this group; unrelated writes proceed.
    if(db.prepare(`SELECT 1 FROM changes c JOIN material_organizer_inputs m ON m.capture_id=c.id
      WHERE c.seq>? AND m.organizer_id=? AND m.group_json=? LIMIT 1`).get(input.checkpoint,input.organizerId,row.group_json))return false;
    // The built-in source item has an exact declared identity. Unrelated source
    // backlog cannot join that group; do not run every organizer selector for
    // every later source on every lease check. Attachment children can join the
    // parent's group, so retain their host lineage as a conservative candidate.
    // Plugins retain the general selector path rather than inheriting this rule.
    const pending=(organizer===sourceItem?db.prepare(`SELECT DISTINCT c.id FROM changes c JOIN captures original ON original.id=c.id
      WHERE c.seq>? AND ((json_extract(original.json,'$.provenance.sourceId')=? AND json_extract(original.json,'$.provenance.externalId')=?)
        OR EXISTS(SELECT 1 FROM file_evidence_links l JOIN captures parent ON parent.id=l.parent_id
          WHERE l.capture_id=c.id AND json_extract(parent.json,'$.provenance.sourceId')=? AND json_extract(parent.json,'$.provenance.externalId')=?))`)
      .all(input.checkpoint,input.group.sourceId,input.group.externalId,input.group.sourceId,input.group.externalId):
      db.prepare('SELECT DISTINCT id FROM changes WHERE seq>?').all(input.checkpoint)) as {id:string}[];
    for(const {id} of pending){
      if(this.selectedFor(id).some(value=>value.organizer.id===input.organizerId&&JSON.stringify(value.group)===row.group_json))return false;
    }
    return true;
  }
  status(){
    const cursor=this.cursor();
    const pendingChanges=(this.store.db.prepare('SELECT COUNT(*) n FROM changes WHERE seq>?').get(cursor) as {n:number}).n;
    const stepCounts:Record<string,number>={waiting:0,running:0,blocked:0,failed:0,succeeded:0,cancelled:0,stale:0};
    // Membership is the shared authority for current progress. History remains
    // readable, and a shared/parent membership must not multiply a step.
    for(const row of this.store.db.prepare(`SELECT e.state,count(*) n FROM execution_steps e WHERE e.kind=?
      AND EXISTS(SELECT 1 FROM execution_operation_steps o WHERE o.step_id=e.id AND o.operation_id=e.operation_id AND o.active=1)
      GROUP BY e.state`).all(ORGANIZER_STEP))stepCounts[String(row.state)]=Number(row.n);
    const pendingSteps=stepCounts.waiting+stepCounts.running;
    const backfills=this.store.db.prepare('SELECT organizer_id id,version,cursor_rowid cursorRowid,complete FROM material_organizer_backfills ORDER BY organizer_id').all() as {id:string;version:string;cursorRowid:number;complete:number}[];
    return {cursor,pendingChanges,pendingSteps,blockedSteps:stepCounts.blocked,failedSteps:stepCounts.failed,stepCounts,organizers:this.registry.list(),backfills:backfills.map(row=>({...row,complete:Boolean(row.complete)}))};
  }
  private discover(limit:number){
    const db=this.store.db,batchSize=Math.max(1,Math.min(limit,500)),stepIds:string[]=[];
    db.exec('BEGIN IMMEDIATE');
    try{
      const rows=db.prepare('SELECT seq,id FROM changes WHERE seq>? ORDER BY seq LIMIT ?').all(this.cursor(),batchSize) as {seq:number;id:string}[];
      const backfill=(db.prepare('SELECT organizer_id id,version,cursor_rowid cursorRowid FROM material_organizer_backfills WHERE complete=0 ORDER BY organizer_id').all() as {id:string;version:string;cursorRowid:number}[])
        .find(row=>this.registry.get(row.id)?.version===row.version);
      const backfillRows=backfill?db.prepare('SELECT rowid,id FROM captures WHERE rowid>? ORDER BY rowid LIMIT ?').all(backfill.cursorRowid,batchSize) as {rowid:number;id:string}[]:[];
      const changedIds=[...new Set([...rows.map(row=>row.id),...backfillRows.map(row=>row.id)])];
      const changedSourceIds=new Set(rows.map(row=>row.id));
      const touched=new Map<string,{organizerId:string;group:Record<string,string>;priorMaterialId:string|null;sourceChanged:boolean}>();
      const replacements=new Map<string,Set<string>>();
      const touch=(organizerId:string,group:Record<string,string>,priorMaterialId:string|null=null,sourceChanged=false)=>{
        const key=digest([organizerId,group]),prior=touched.get(key);
        touched.set(key,{organizerId,group,priorMaterialId:prior?.priorMaterialId??priorMaterialId,sourceChanged:Boolean(prior?.sourceChanged||sourceChanged)});
      };
      for(const captureId of changedIds){
        const previous=db.prepare('SELECT organizer_id,group_json,material_id FROM material_organizer_inputs WHERE capture_id=?').all(captureId) as {organizer_id:string;group_json:string;material_id:string|null}[];
        for(const row of previous)touch(row.organizer_id,canonicalGroup(JSON.parse(row.group_json) as Record<string,string>),row.material_id);
        const selections=this.selectedFor(captureId);
        for(const old of previous){
          const oldKey=digest([old.organizer_id,canonicalGroup(JSON.parse(old.group_json) as Record<string,string>)]);
          for(const {organizer,group} of selections){
            const newKey=digest([organizer.id,group]);
            if(newKey===oldKey||!old.material_id||organizer.identity(group)===old.material_id)continue;
            const next=replacements.get(oldKey)??new Set<string>();next.add(newKey);replacements.set(oldKey,next);
          }
        }
        db.prepare('DELETE FROM material_organizer_inputs WHERE capture_id=?').run(captureId);
        for(const {organizer,group} of selections){
          touch(organizer.id,group,null,changedSourceIds.has(captureId));
          db.prepare('INSERT INTO material_organizer_inputs(capture_id,organizer_id,group_json,material_id) VALUES(?,?,?,?)').run(captureId,organizer.id,JSON.stringify(group),organizer.identity(group)??null);
        }
      }
      // Pin only the discovered change range. Later rows in this same batch
      // backlog must still invalidate a group before its fenced commit.
      const checkpoint=rows.at(-1)?.seq??this.cursor();
      const prepared:{key:string;input:OrganizerJobInput;id:string}[]=[];
      for(const [key,{organizerId,group,priorMaterialId,sourceChanged}] of touched){
        const organizer=this.registry.get(organizerId),prior=db.prepare('SELECT * FROM material_organizer_groups WHERE group_key=?').get(key) as OrganizerGroupRow|undefined;
        const materialId=organizer?.identity(group)??priorMaterialId??prior?.material_id;
        if(!materialId)continue;
        if(priorMaterialId&&priorMaterialId!==materialId&&prior?.version===organizer?.version)throw Error('Material organizer identity changed without a version change');
        const groupJson=JSON.stringify(group),mapped=db.prepare('SELECT capture_id FROM material_organizer_inputs WHERE organizer_id=? AND group_json=?').all(organizerId,groupJson) as {capture_id:string}[];
        const active=Boolean(organizer&&mapped.some(row=>this.selectedFor(row.capture_id).some(value=>value.organizer.id===organizerId&&JSON.stringify(value.group)===groupJson)));
        const version=organizer?.version??prior?.version??'retired',generation=(prior?.generation??0)+1;
        db.prepare(`INSERT INTO material_organizer_groups(group_key,organizer_id,version,group_json,material_id,generation,checkpoint,active) VALUES(?,?,?,?,?,?,?,?)
          ON CONFLICT(group_key) DO UPDATE SET version=excluded.version,group_json=excluded.group_json,material_id=excluded.material_id,
            generation=excluded.generation,checkpoint=excluded.checkpoint,active=excluded.active`).run(key,organizerId,version,groupJson,materialId,generation,checkpoint,Number(active));
        const recipe=active&&organizerId===sourceItem.id?this.sourceItemRecipes.resolveForSourceId(group.sourceId):undefined;
        const input:OrganizerJobInput={groupKey:key,organizerId,version,group,materialId,generation,checkpoint,active,sourceChanged,...(recipe?{recipe}:{})};
        prepared.push({key,input,id:digest([ORGANIZER_STEP,key,generation])});
      }
      const ids=new Map(prepared.map(item=>[item.key,item.id]));
      for(const item of prepared.filter(item=>item.input.active))stepIds.push(this.executor.enqueue(`material-organizer:${item.key}`,ORGANIZER_STEP,item.input,{id:item.id,generation:{slot:'organize',version:String(item.input.generation)}}));
      for(const item of prepared.filter(item=>!item.input.active)){
        const dependencies=[...(replacements.get(item.key)??[])].flatMap(key=>ids.has(key)?[ids.get(key)!]:[]);
        stepIds.push(this.executor.enqueue(`material-organizer:${item.key}`,ORGANIZER_STEP,item.input,{id:item.id,dependencies,generation:{slot:'organize',version:String(item.input.generation)}}));
      }
      if(rows.length)db.prepare("INSERT INTO settings(key,value) VALUES('material-organizer-cursor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(rows.at(-1)!.seq));
      if(backfill)db.prepare('UPDATE material_organizer_backfills SET cursor_rowid=?,complete=? WHERE organizer_id=? AND version=?').run(
        backfillRows.at(-1)?.rowid??backfill.cursorRowid,backfillRows.length<batchSize?1:0,backfill.id,backfill.version);
      db.exec('COMMIT');return {count:changedIds.length,stepIds};
    }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
  }
  async tick(limit=100){
    if(this.closed||this.running)return 0;this.running=true;
    try{
      const {count,stepIds}=this.discover(limit);
      const waiting=this.store.db.prepare("SELECT id FROM execution_steps WHERE kind=? AND state='waiting' AND available_at<=?").all(ORGANIZER_STEP,Date.now()) as {id:string}[];
      await this.executor.drain([...new Set([...stepIds,...waiting.map(row=>row.id)])]);
      await this.executor.drain(this.retryReadyRetirements());
      for(const id of stepIds){const failure=this.failures.get(id);if(failure)throw failure;}
      await this.materials.index?.tick();
      return count;
    }finally{this.running=false;}
  }
  async close(){
    this.closed=true;await this.unregister();
  }

}

declare module '@deepseek-ai/cordis' {interface Context {moteMaterialOrganizers:MaterialOrganizerRegistry;}}
