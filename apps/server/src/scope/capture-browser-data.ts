import {z} from 'zod';
import {sourceSchema,systemEventText,transcriptSchema,type CapturePreview,type CaptureRecord} from '@mote/shared';
import {captureOcrState} from '@mote/shared/metadata';
import {PrivateSql,PrivateCursor,PrivateDataError,missing} from './private-data-sql.js';

const time=z.string().datetime({offset:true});
export const captureBrowseSchema=z.object({
 after:time.optional(),before:time.optional(),deviceId:z.string().min(1).max(128).optional(),appId:z.string().max(300).optional(),source:sourceSchema.optional(),
 collection:z.enum(['content','activity']).optional(),ocrStatus:z.enum(['pending','completed','disabled','failed','unknown','not_applicable']).optional(),
 limit:z.coerce.number().int().min(1).max(60).default(30),cursor:z.string().max(8192).optional(),
}).strict().refine(v=>!v.after||!v.before||Date.parse(v.after)<Date.parse(v.before),{message:'Invalid time range'});
const groupFields={after:time,before:time,deviceId:z.string().min(1).max(128).optional(),limit:z.coerce.number().int().min(1).max(60).default(20),cursor:z.string().max(8192).optional()};
export const captureGallerySchema=z.object({...groupFields,appId:z.string().max(300).optional()}).strict().refine(v=>Date.parse(v.after)<Date.parse(v.before),{message:'Invalid time range'});
export const captureSessionSchema=z.object({...groupFields,sessionId:z.string().uuid().optional()}).strict().refine(v=>Date.parse(v.after)<Date.parse(v.before)&&Date.parse(v.before)-Date.parse(v.after)<=32*86400000,{message:'Select up to 32 days for session browsing'});
const positionSchema=z.object({at:time,id:z.string()}).strict();

/** Presentation over the existing private repository. Every candidate and join
 * keeps the host's owner binding, with filters/grouping applied before LIMIT.
 * No original bytes, legacy Store or separate user runtime is constructed. */
export class CaptureBrowserData{
 constructor(private readonly sql:PrivateSql,private readonly cursor:PrivateCursor,private readonly capture:(id:string)=>CaptureRecord,private readonly processing=false){}
 private get base(){return `WITH extraction AS (${this.processing?`SELECT r.capture_id,p.material_id,a.id artifact_id,a.json payload,v.created_at updated_at FROM ig_originals r
  JOIN mp_publications p ON p.user_id=r.user_id AND p.original_id=r.id JOIN mp_artifacts a ON a.user_id=p.user_id AND a.id=p.artifact_id AND a.original_id=r.id AND a.complete=1
  JOIN pd_materials h ON h.user_id=p.user_id AND h.id=p.material_id JOIN pd_material_versions v ON v.user_id=h.user_id AND v.material_id=h.id AND v.revision=h.revision
  JOIN pd_material_captures m ON m.user_id=h.user_id AND m.material_id=h.id AND m.revision=h.revision AND m.capture_id=r.capture_id AND m.member_id='original'
  WHERE r.user_id=$user AND p.user_id=$user AND a.user_id=$user AND h.user_id=$user AND v.user_id=$user AND m.user_id=$user AND h.sequence>=h.min_visible_sequence
  AND EXISTS(SELECT 1 FROM json_each(v.json,'$.artifacts') artifact WHERE json_extract(artifact.value,'$.key')='extraction' AND json_extract(artifact.value,'$.state')='ready' AND json_extract(artifact.value,'$.revision')=a.id)`:`SELECT id capture_id,NULL material_id,NULL artifact_id,NULL payload,NULL updated_at FROM pd_captures WHERE user_id=$user AND 0`}),
  browser AS (SELECT c.user_id,c.id,c.context_at,c.json,x.material_id extraction_material,x.artifact_id extraction_artifact,x.payload extraction_payload,x.updated_at extraction_at,
  json_extract(c.json,'$.deviceId') device_id,json_extract(c.json,'$.appId') app_id,json_extract(c.json,'$.appName') app_name,
  json_extract(c.json,'$.capturedAt') captured_at,json_extract(c.json,'$.source') source,
  json_extract(c.json,'$.originalImage.hash') IS NOT NULL has_image,
  CASE WHEN json_extract(c.json,'$.source')!='screen' THEN 'not_applicable' WHEN x.payload IS NOT NULL THEN 'completed' ELSE COALESCE(json_extract(c.json,'$.ocr.status'),'unknown') END ocr_status
  FROM pd_captures c LEFT JOIN extraction x ON x.capture_id=c.id WHERE c.user_id=$user AND (c.source_id IS NULL OR EXISTS(SELECT 1 FROM pd_source_heads h WHERE h.user_id=$user AND h.capture_id=c.id AND COALESCE(json_extract(c.json,'$.provenance.deleted'),0)=0)))`;}
 private scope(raw:z.infer<typeof captureBrowseSchema>,screens=false){
  const clauses=screens?["source='screen'"]:['1'],args:(string|number)[]=[];
  if(raw.after){clauses.push("COALESCE(json_extract(json,'$.stateSeries.samples[#-1].at'),context_at)>=?");args.push(new Date(raw.after).toISOString());}
  if(raw.before){clauses.push('context_at<?');args.push(new Date(raw.before).toISOString());}
  if(raw.deviceId){clauses.push('device_id=?');args.push(raw.deviceId);}
  if(raw.appId!==undefined){clauses.push("((source!='media' AND app_id=?) OR(source='media' AND EXISTS(SELECT 1 FROM json_each(browser.json,'$.metadata.media.sessions') s WHERE json_extract(s.value,'$.appId')=?)))");args.push(raw.appId,raw.appId);}
  if(raw.source){clauses.push('source=?');args.push(raw.source);}
  if(raw.ocrStatus){clauses.push('ocr_status=?');args.push(raw.ocrStatus);}
  if(raw.collection==='activity')clauses.push("json_extract(json,'$.privacy.collection')='activity'");
  if(raw.collection==='content')clauses.push("source!='activity' AND COALESCE(json_extract(json,'$.privacy.collection'),'content')='content'");
  return {where:clauses.join(' AND '),args};
 }
 private pageCursor(query:unknown,value:string|undefined){return value?positionSchema.parse(this.cursor.decodeCompact(value,query)):undefined;}
 record(id:string,raw:unknown={}):CaptureRecord&{fileArchive?:{captureId:string}}{
  z.string().uuid().parse(id);const filters=captureBrowseSchema.parse(raw),{where,args}=this.scope(filters);
  const row=this.sql.get(`${this.base} SELECT * FROM browser WHERE user_id=$user AND ${where} AND id=?`,...args,id);if(!row)throw missing();
  const record=this.capture(id);
  if(record.source==='file'&&this.processing&&this.sql.get("SELECT r.id FROM ig_originals r JOIN mp_original_formats f ON f.user_id=r.user_id AND f.original_id=r.id JOIN pd_sources s ON s.user_id=r.user_id AND s.id=r.source_id WHERE r.user_id=$user AND f.user_id=$user AND s.user_id=$user AND (f.format='file' OR f.format GLOB 'processor:*') AND r.capture_id=? AND COALESCE(json_extract(s.json,'$.enabled'),1)=1",id))return {...record,fileArchive:{captureId:id}};
  if(record.source!=='screen'||!row.extraction_payload)return record;
  const transcript=transcriptSchema.parse(JSON.parse(String(row.extraction_payload)));
  return {...record,ocrText:transcript.segments.map(s=>s.text).join('\n'),ocr:{status:'completed',updatedAt:String(row.extraction_at)}};
 }
 private next(query:unknown,rows:Record<string,any>[],limit:number,at='capturedAt',id='id'){
  const last=rows.slice(0,limit).at(-1);return rows.length>limit&&last?this.cursor.encodeCompact(query,{at:String(last[at]),id:String(last[id])}):null;
 }
 previews(raw:unknown){
  const {cursor,limit,...filters}=captureBrowseSchema.parse(raw),query={collection:'capture-browser',...filters},position=this.pageCursor(query,cursor),{where,args}=this.scope({...filters,limit});
  const totalCount=Number(this.sql.get(`${this.base} SELECT count(*) n FROM browser WHERE user_id=$user AND ${where}`,...args)!.n);
  const rows=this.sql.all(`${this.base} SELECT id,context_at FROM browser WHERE user_id=$user AND ${where}${position?' AND(context_at<? OR(context_at=? AND id<?))':''} ORDER BY context_at DESC,id DESC LIMIT ?`,...args,...(position?[position.at,position.at,position.id]:[]),limit+1);
  return {items:rows.slice(0,limit).map(row=>this.preview(this.record(String(row.id)))),totalCount,nextCursor:this.next(query,rows,limit,'context_at')};
 }
 /** Synchronous projection notification after a real M06 extraction commits.
  * M16 may call the same hook after a successful canonical merge. It authorizes
  * no work and restores no old task/model/credential authority. */
 published(materialId:string){
  const rows=this.sql.all(`${this.base} SELECT DISTINCT c.id,c.device_id device,c.extraction_artifact artifact FROM browser c JOIN pd_material_captures m ON m.capture_id=c.id JOIN pd_materials h ON h.user_id=m.user_id AND h.id=m.material_id AND h.revision=m.revision WHERE c.user_id=$user AND m.user_id=$user AND h.user_id=$user AND h.id=? AND h.id=c.extraction_material AND h.sequence>=h.min_visible_sequence AND c.source='screen' AND c.extraction_artifact IS NOT NULL`,materialId);
  this.appendUpdates(rows);
 }
 private appendUpdates(rows:Record<string,any>[]){this.sql.transaction(()=>{for(const row of rows){const device=String(row.device),capture=String(row.id),artifact=String(row.artifact);if(this.sql.get('SELECT sequence FROM ig_capture_updates WHERE user_id=$user AND device_id=? AND capture_id=? AND artifact_id=?',device,capture,artifact))continue;const sequence=this.sql.get('INSERT INTO ig_capture_update_sequences VALUES($user,?,1) ON CONFLICT(user_id,device_id) DO UPDATE SET next=next+1 RETURNING next',device)!.next;this.sql.run('INSERT INTO ig_capture_updates VALUES($user,?,?,?,?)',device,sequence,capture,artifact);}});}
 private reconcileUpdates(deviceId:string,limit:number){
  const rows=this.sql.all(`${this.base} SELECT c.id,c.device_id device,c.extraction_artifact artifact FROM browser c JOIN ig_capture_scopes b ON b.user_id=c.user_id AND b.capture_id=c.id JOIN pd_sources s ON s.user_id=b.user_id AND s.id=b.source_id WHERE c.user_id=$user AND b.user_id=$user AND s.user_id=$user AND c.device_id=? AND c.source='screen' AND c.extraction_artifact IS NOT NULL AND COALESCE(json_extract(s.json,'$.enabled'),1)=1 AND NOT EXISTS(SELECT 1 FROM ig_capture_updates u WHERE u.user_id=$user AND u.device_id=c.device_id AND u.capture_id=c.id AND u.artifact_id=c.extraction_artifact) ORDER BY c.id LIMIT ?`,deviceId,limit);
  this.appendUpdates(rows);
 }
 updates(deviceId:string,cursor=0,limit=100){
  const previous=Number(this.sql.get('SELECT next FROM ig_capture_update_sequences WHERE user_id=$user AND device_id=?',deviceId)?.next??0);
  if(cursor>previous)throw new PrivateDataError('invalid_cursor',409);
  // A canonical import/first upgrade may have no derived notification rows.
  // Reconcile a bounded page under this read's existing authority, never a task.
  this.reconcileUpdates(deviceId,limit);
  const rows=this.sql.all(`SELECT u.sequence,u.capture_id FROM ig_capture_updates u JOIN pd_captures c ON c.user_id=u.user_id AND c.id=u.capture_id JOIN ig_capture_scopes b ON b.user_id=c.user_id AND b.capture_id=c.id JOIN pd_sources s ON s.user_id=b.user_id AND s.id=b.source_id WHERE u.user_id=$user AND c.user_id=$user AND b.user_id=$user AND s.user_id=$user AND u.device_id=? AND u.sequence>? AND json_extract(c.json,'$.deviceId')=? AND COALESCE(json_extract(s.json,'$.enabled'),1)=1 ORDER BY u.sequence LIMIT ?`,deviceId,cursor,deviceId,limit);
  const items=rows.flatMap(row=>{try{const record=this.record(String(row.capture_id));return [{id:record.id,ocr:captureOcrState(record),textPreview:record.ocrText.slice(0,1000),textLength:record.ocrText.length}];}catch(error){if(error instanceof Error&&'statusCode' in error&&error.statusCode===404)return [];throw error;}});
  const high=Number(this.sql.get('SELECT next FROM ig_capture_update_sequences WHERE user_id=$user AND device_id=?',deviceId)?.next??0);
  return {items,nextCursor:rows.length===limit?Number(rows.at(-1)!.sequence):Math.max(cursor,high)};
 }
 private preview(record:CaptureRecord):CapturePreview{
  const original=this.sql.get('SELECT sum(o.bytes) bytes FROM ig_originals r JOIN ig_objects o ON o.user_id=r.user_id AND o.hash=r.hash WHERE r.user_id=$user AND o.user_id=$user AND r.capture_id=?',record.id);
  const text=record.source==='media'?record.metadata?.media?.sessions.map(s=>[s.title,s.artist,s.appName].filter(Boolean).join(' · ')).join(' / ')??'':record.source==='notification'||record.source==='device_event'?systemEventText(record.metadata):record.ocrText;
  return {id:record.id,deviceId:record.deviceId,deviceName:record.deviceName,platform:record.platform,capturedAt:record.capturedAt,source:record.source,appId:record.appId,appName:record.appName,windowTitle:(record.windowTitle??'').slice(0,300),durationMs:record.durationMs,hasImage:Boolean(record.blobHash),ocr:captureOcrState(record),textPreview:text.slice(0,160),sizeBytes:Buffer.byteLength(record.ocrText)+Number(original?.bytes??record.provenance?.metadata?.file?.sizeBytes??0),...(record.metadata?.media?{media:record.metadata.media}:{}),...(record.stateSeries?{stateSummary:{count:record.stateSeries.samples.length,lastAt:record.stateSeries.samples.at(-1)!.at}}:{})};
 }
 gallery(raw:unknown,albums:boolean){
  const {cursor,limit,...filters}=captureGallerySchema.parse(raw);if(!albums&&filters.appId===undefined)throw new z.ZodError([{code:'custom',path:['appId'],message:'Album appId is required'}]);
  const query={collection:albums?'capture-albums':'capture-album-images',...filters},position=this.pageCursor(query,cursor),{where,args}=this.scope({...filters,limit},true);
  const totalCount=Number(this.sql.get(`${this.base} SELECT count(*) n FROM browser WHERE user_id=$user AND ${where}`,...args)!.n);
  if(!albums){const rows=this.sql.all(`${this.base} SELECT id,device_id deviceId,captured_at capturedAt,app_id appId,app_name appName,has_image hasImage FROM browser WHERE user_id=$user AND ${where}${position?' AND(captured_at<? OR(captured_at=? AND id<?))':''} ORDER BY captured_at DESC,id DESC LIMIT ?`,...args,...(position?[position.at,position.at,position.id]:[]),limit+1);return {items:rows.slice(0,limit).map(r=>({...r,source:'screen',hasImage:Boolean(r.hasImage)})),totalCount,nextCursor:this.next(query,rows,limit)};}
  const grouped=`${this.base}, grouped AS (SELECT user_id,MIN(id) id,device_id deviceId,app_id appId,app_name appName,MIN(captured_at) firstAt,MAX(captured_at) capturedAt,COUNT(*) count,SUM(has_image) imageCount,CAST(strftime('%s',captured_at) AS INTEGER)/900 bucket FROM browser WHERE user_id=$user AND ${where} GROUP BY device_id,app_id,CAST(strftime('%s',captured_at) AS INTEGER)/900)`;
  const albumCount=Number(this.sql.get(`${grouped} SELECT count(*) n FROM grouped WHERE user_id=$user`,...args)!.n),key=position?z.tuple([z.string(),z.string()]).parse(JSON.parse(position.id)):undefined,bucket=position?Math.floor(Date.parse(position.at)/900000):0;
  const rows=this.sql.all(`${grouped} SELECT id,deviceId,appId,appName,firstAt,capturedAt,count,imageCount,bucket FROM grouped WHERE user_id=$user ${position?'AND(bucket<? OR(bucket=? AND(deviceId>? OR(deviceId=? AND appId>?))))':''} ORDER BY bucket DESC,deviceId,appId LIMIT ?`,...args,...(key?[bucket,bucket,key[0],key[0],key[1]]:[]),limit+1);
  const items=rows.slice(0,limit).map(row=>({id:String(row.id),deviceId:String(row.deviceId),appId:String(row.appId),appName:String(row.appName),firstAt:String(row.firstAt),capturedAt:String(row.capturedAt),count:Number(row.count),imageCount:Number(row.imageCount),after:new Date(Number(row.bucket)*900000).toISOString(),before:new Date((Number(row.bucket)+1)*900000).toISOString()})),last=items.at(-1);
  return {items,totalCount,albumCount,nextCursor:rows.length>limit&&last?this.cursor.encodeCompact(query,{at:last.after,id:JSON.stringify([last.deviceId,last.appId])}):null};
 }
 sessions(raw:unknown){
  const {cursor,limit,sessionId,...filters}=captureSessionSchema.parse(raw),query={collection:'capture-sessions',...filters,...(sessionId?{sessionId}:{})},position=this.pageCursor(query,cursor),{where,args}=this.scope({...filters,limit},true);
  // Same observed-time algorithm as EvidenceStore and shared captureSessions:
  // partition by device before pagination, preserve A→B→A and gaps over 5 min.
  const cte=`${this.base}, observed AS (SELECT *,LAG(app_id) OVER w previous_app,LAG(captured_at) OVER w previous_at FROM browser WHERE user_id=$user AND ${where} WINDOW w AS(PARTITION BY device_id ORDER BY captured_at,id)),
   segmented AS(SELECT *,SUM(CASE WHEN previous_at IS NULL OR app_id='' OR app_id!=previous_app OR(julianday(captured_at)-julianday(previous_at))*86400000>300000.1 THEN 1 ELSE 0 END) OVER(PARTITION BY device_id ORDER BY captured_at,id) segment FROM observed),
   members AS(SELECT *,FIRST_VALUE(id) OVER(PARTITION BY device_id,segment ORDER BY captured_at,id) session_id FROM segmented)`;
  if(sessionId){const totalCount=Number(this.sql.get(`${cte} SELECT count(*) n FROM members WHERE user_id=$user AND session_id=?`,...args,sessionId)!.n);if(!totalCount)throw missing();const rows=this.sql.all(`${cte} SELECT id,device_id deviceId,captured_at capturedAt,app_id appId,app_name appName,has_image hasImage FROM members WHERE user_id=$user AND session_id=? ${position?'AND(captured_at<? OR(captured_at=? AND id<?))':''} ORDER BY captured_at DESC,id DESC LIMIT ?`,...args,sessionId,...(position?[position.at,position.at,position.id]:[]),limit+1);return {items:rows.slice(0,limit).map(r=>({...r,source:'screen',hasImage:Boolean(r.hasImage)})),totalCount,nextCursor:this.next(query,rows,limit)};}
  const grouped=`${cte}, grouped AS(SELECT user_id,session_id id,device_id deviceId,app_id appId,app_name appName,MIN(captured_at) firstAt,MAX(captured_at) capturedAt,COUNT(*) count,SUM(has_image) imageCount FROM members GROUP BY device_id,segment)`;
  const counts=this.sql.get(`${grouped} SELECT count(*) sessionCount,COALESCE(sum(count),0) totalCount FROM grouped WHERE user_id=$user`,...args)!;
  const rows=this.sql.all(`${grouped} SELECT id,deviceId,appId,appName,firstAt,capturedAt,count,imageCount FROM grouped WHERE user_id=$user ${position?'AND(firstAt<? OR(firstAt=? AND id>?))':''} ORDER BY firstAt DESC,id LIMIT ?`,...args,...(position?[position.at,position.at,position.id]:[]),limit+1);
  return {items:rows.slice(0,limit).map(r=>({...r,after:r.firstAt,before:new Date(Date.parse(String(r.capturedAt))+1).toISOString()})),...counts,gapMs:300000,nextCursor:this.next(query,rows,limit,'firstAt')};
 }
}
