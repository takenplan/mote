import {z} from 'zod';
import {sourceSchema,systemEventText,type CapturePreview,type CaptureRecord} from '@mote/shared';
import {captureOcrState} from '@mote/shared/metadata';
import {PrivateSql,PrivateCursor,missing} from './private-data-sql.js';

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
 constructor(private readonly sql:PrivateSql,private readonly cursor:PrivateCursor,private readonly capture:(id:string)=>CaptureRecord){}
 private base=`WITH browser AS (SELECT c.id,c.context_at,c.json,
  json_extract(c.json,'$.deviceId') device_id,json_extract(c.json,'$.appId') app_id,json_extract(c.json,'$.appName') app_name,
  json_extract(c.json,'$.capturedAt') captured_at,json_extract(c.json,'$.source') source,
  json_extract(c.json,'$.originalImage.hash') IS NOT NULL has_image,
  CASE WHEN json_extract(c.json,'$.source')!='screen' THEN 'not_applicable' ELSE COALESCE(json_extract(c.json,'$.ocr.status'),'unknown') END ocr_status
  FROM pd_captures c WHERE c.user_id=$user AND (c.source_id IS NULL OR EXISTS(SELECT 1 FROM pd_source_heads h WHERE h.user_id=$user AND h.capture_id=c.id AND COALESCE(json_extract(c.json,'$.provenance.deleted'),0)=0)))`;
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
 record(id:string,raw:unknown={}){
  z.string().uuid().parse(id);const filters=captureBrowseSchema.parse(raw),{where,args}=this.scope(filters);
  if(!this.sql.get(`${this.base} SELECT id FROM browser WHERE ${where} AND id=?`,...args,id))throw missing();
  return this.capture(id);
 }
 private next(query:unknown,rows:Record<string,any>[],limit:number,at='capturedAt',id='id'){
  const last=rows.slice(0,limit).at(-1);return rows.length>limit&&last?this.cursor.encodeCompact(query,{at:String(last[at]),id:String(last[id])}):null;
 }
 previews(raw:unknown){
  const {cursor,limit,...filters}=captureBrowseSchema.parse(raw),query={collection:'capture-browser',...filters},position=this.pageCursor(query,cursor),{where,args}=this.scope({...filters,limit});
  const totalCount=Number(this.sql.get(`${this.base} SELECT count(*) n FROM browser WHERE ${where}`,...args)!.n);
  const rows=this.sql.all(`${this.base} SELECT id,context_at FROM browser WHERE ${where}${position?' AND(context_at<? OR(context_at=? AND id<?))':''} ORDER BY context_at DESC,id DESC LIMIT ?`,...args,...(position?[position.at,position.at,position.id]:[]),limit+1);
  return {items:rows.slice(0,limit).map(row=>this.preview(this.capture(String(row.id)))),totalCount,nextCursor:this.next(query,rows,limit,'context_at')};
 }
 private preview(record:CaptureRecord):CapturePreview{
  const original=this.sql.get('SELECT sum(o.bytes) bytes FROM ig_originals r JOIN ig_objects o ON o.user_id=r.user_id AND o.hash=r.hash WHERE r.user_id=$user AND o.user_id=$user AND r.capture_id=?',record.id);
  const text=record.source==='media'?record.metadata?.media?.sessions.map(s=>[s.title,s.artist,s.appName].filter(Boolean).join(' · ')).join(' / ')??'':record.source==='notification'||record.source==='device_event'?systemEventText(record.metadata):record.ocrText;
  return {id:record.id,deviceId:record.deviceId,deviceName:record.deviceName,platform:record.platform,capturedAt:record.capturedAt,source:record.source,appId:record.appId,appName:record.appName,windowTitle:(record.windowTitle??'').slice(0,300),durationMs:record.durationMs,hasImage:Boolean(record.blobHash),ocr:captureOcrState(record),textPreview:text.slice(0,160),sizeBytes:Buffer.byteLength(record.ocrText)+Number(original?.bytes??record.provenance?.metadata?.file?.sizeBytes??0),...(record.metadata?.media?{media:record.metadata.media}:{}),...(record.stateSeries?{stateSummary:{count:record.stateSeries.samples.length,lastAt:record.stateSeries.samples.at(-1)!.at}}:{})};
 }
 gallery(raw:unknown,albums:boolean){
  const {cursor,limit,...filters}=captureGallerySchema.parse(raw);if(!albums&&filters.appId===undefined)throw new z.ZodError([{code:'custom',path:['appId'],message:'Album appId is required'}]);
  const query={collection:albums?'capture-albums':'capture-album-images',...filters},position=this.pageCursor(query,cursor),{where,args}=this.scope({...filters,limit},true),scope=`FROM browser WHERE ${where}`;
  const totalCount=Number(this.sql.get(`${this.base} SELECT count(*) n ${scope}`,...args)!.n);
  if(!albums){const rows=this.sql.all(`${this.base} SELECT id,device_id deviceId,captured_at capturedAt,app_id appId,app_name appName,has_image hasImage ${scope}${position?' AND(captured_at<? OR(captured_at=? AND id<?))':''} ORDER BY captured_at DESC,id DESC LIMIT ?`,...args,...(position?[position.at,position.at,position.id]:[]),limit+1);return {items:rows.slice(0,limit).map(r=>({...r,source:'screen',hasImage:Boolean(r.hasImage)})),totalCount,nextCursor:this.next(query,rows,limit)};}
  const group=`${scope} GROUP BY device_id,app_id,CAST(strftime('%s',captured_at) AS INTEGER)/900`,grouped=`${this.base}, grouped AS (SELECT MIN(id) id,device_id deviceId,app_id appId,app_name appName,MIN(captured_at) firstAt,MAX(captured_at) capturedAt,COUNT(*) count,SUM(has_image) imageCount,CAST(strftime('%s',captured_at) AS INTEGER)/900 bucket ${group})`;
  const albumCount=Number(this.sql.get(`${grouped} SELECT count(*) n FROM grouped`,...args)!.n),key=position?z.tuple([z.string(),z.string()]).parse(JSON.parse(position.id)):undefined,bucket=position?Math.floor(Date.parse(position.at)/900000):0;
  const rows=this.sql.all(`${grouped} SELECT * FROM grouped ${position?'WHERE bucket<? OR(bucket=? AND(deviceId>? OR(deviceId=? AND appId>?)))':''} ORDER BY bucket DESC,deviceId,appId LIMIT ?`,...args,...(key?[bucket,bucket,key[0],key[0],key[1]]:[]),limit+1);
  const items=rows.slice(0,limit).map(row=>({id:String(row.id),deviceId:String(row.deviceId),appId:String(row.appId),appName:String(row.appName),firstAt:String(row.firstAt),capturedAt:String(row.capturedAt),count:Number(row.count),imageCount:Number(row.imageCount),after:new Date(Number(row.bucket)*900000).toISOString(),before:new Date((Number(row.bucket)+1)*900000).toISOString()})),last=items.at(-1);
  return {items,totalCount,albumCount,nextCursor:rows.length>limit&&last?this.cursor.encodeCompact(query,{at:last.after,id:JSON.stringify([last.deviceId,last.appId])}):null};
 }
 sessions(raw:unknown){
  const {cursor,limit,sessionId,...filters}=captureSessionSchema.parse(raw),query={collection:'capture-sessions',...filters,...(sessionId?{sessionId}:{})},position=this.pageCursor(query,cursor),{where,args}=this.scope({...filters,limit},true);
  // Same observed-time algorithm as EvidenceStore and shared captureSessions:
  // partition by device before pagination, preserve A→B→A and gaps over 5 min.
  const cte=`${this.base}, observed AS (SELECT *,LAG(app_id) OVER w previous_app,LAG(captured_at) OVER w previous_at FROM browser WHERE ${where} WINDOW w AS(PARTITION BY device_id ORDER BY captured_at,id)),
   segmented AS(SELECT *,SUM(CASE WHEN previous_at IS NULL OR app_id='' OR app_id!=previous_app OR(julianday(captured_at)-julianday(previous_at))*86400000>300000.1 THEN 1 ELSE 0 END) OVER(PARTITION BY device_id ORDER BY captured_at,id) segment FROM observed),
   members AS(SELECT *,FIRST_VALUE(id) OVER(PARTITION BY device_id,segment ORDER BY captured_at,id) session_id FROM segmented)`;
  if(sessionId){const totalCount=Number(this.sql.get(`${cte} SELECT count(*) n FROM members WHERE session_id=?`,...args,sessionId)!.n);if(!totalCount)throw missing();const rows=this.sql.all(`${cte} SELECT id,device_id deviceId,captured_at capturedAt,app_id appId,app_name appName,has_image hasImage FROM members WHERE session_id=? ${position?'AND(captured_at<? OR(captured_at=? AND id<?))':''} ORDER BY captured_at DESC,id DESC LIMIT ?`,...args,sessionId,...(position?[position.at,position.at,position.id]:[]),limit+1);return {items:rows.slice(0,limit).map(r=>({...r,source:'screen',hasImage:Boolean(r.hasImage)})),totalCount,nextCursor:this.next(query,rows,limit)};}
  const grouped=`${cte}, grouped AS(SELECT session_id id,device_id deviceId,app_id appId,app_name appName,MIN(captured_at) firstAt,MAX(captured_at) capturedAt,COUNT(*) count,SUM(has_image) imageCount FROM members GROUP BY device_id,segment)`;
  const counts=this.sql.get(`${grouped} SELECT count(*) sessionCount,COALESCE(sum(count),0) totalCount FROM grouped`,...args)!;
  const rows=this.sql.all(`${grouped} SELECT * FROM grouped ${position?'WHERE firstAt<? OR(firstAt=? AND id>?)':''} ORDER BY firstAt DESC,id LIMIT ?`,...args,...(position?[position.at,position.at,position.id]:[]),limit+1);
  return {items:rows.slice(0,limit).map(r=>({...r,after:r.firstAt,before:new Date(Date.parse(String(r.capturedAt))+1).toISOString()})),...counts,gapMs:300000,nextCursor:this.next(query,rows,limit,'firstAt')};
 }
}
