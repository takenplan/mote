import type {ConnectorContext} from './types.js';
import type {LarkContext} from './ports.js';
import {FILE_PART_BYTES} from '@mote/shared';
import {createHash} from 'node:crypto';
import {ConnectorError} from './types.js';
/** Only the explicit old-epoch fixture uses this global ledger/FileStore adapter. */
export function legacyLarkContext(ctx:ConnectorContext):LarkContext {
 const db=ctx.store.db;
 db.exec('CREATE TABLE IF NOT EXISTS lark_document_sync(account TEXT NOT NULL,scope TEXT NOT NULL,key TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(account,scope,key));');
 return {...ctx,ledger:{
  get:<T>(a:string,s:string,k:string)=>{const r=db.prepare('SELECT json FROM lark_document_sync WHERE account=? AND scope=? AND key=?').get(a,s,k);return r?JSON.parse(String(r.json)) as T:undefined;},
  set:(a,s,k,v)=>{db.prepare('INSERT INTO lark_document_sync VALUES(?,?,?,?) ON CONFLICT(account,scope,key) DO UPDATE SET json=excluded.json').run(a,s,k,JSON.stringify(v));},
  drop:(a,s,k)=>{db.prepare('DELETE FROM lark_document_sync WHERE account=? AND scope=? AND key=?').run(a,s,k);},
  rows:<T>(a:string,s:string,p:string,l=-1,e=false)=>(db.prepare(`SELECT key,json FROM lark_document_sync WHERE account=? AND scope=? AND key LIKE ?${e?" AND json_extract(json,'$.error') IS NOT NULL":''} ORDER BY key LIMIT ?`).all(a,s,p+'%',l) as {key:string;json:string}[]).map(r=>({key:r.key,value:JSON.parse(r.json) as T})),
  forgotten:(source,id)=>(id?db.prepare('SELECT external_id FROM file_forgotten WHERE source_id=? AND external_id=?').all(source,id):db.prepare('SELECT external_id FROM file_forgotten WHERE source_id=?').all(source)).map(r=>String(r.external_id)),
  versionExists:(source,id)=>Boolean(db.prepare('SELECT 1 FROM source_versions WHERE source_id=? AND external_id=?').get(source,id)),
  counts:source=>{const rows=db.prepare("SELECT json_extract(c.json,'$.source') kind,COUNT(*) count FROM source_heads h JOIN captures c ON c.id=h.capture_id WHERE h.source_id=? AND h.deleted=0 GROUP BY kind").all(source);return {exists:Boolean(db.prepare('SELECT 1 FROM source_connections WHERE id=?').get(source)),documents:Number(rows.find(r=>r.kind==='file')?.count??0),activities:Number(rows.find(r=>r.kind==='event')?.count??0)};},
 },publishFile:async(sourceId,item,bytes,authorize,signal)=>{
  if(!ctx.files)throw new ConnectorError('lark_file_archive_unavailable',503);
  const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex'),prior=ctx.sources.getItem(sourceId,item.externalId),upload=ctx.files.begin({sourceId,previousRevision:prior?.revision??null,item,relativePath:`lark/${hash(item.externalId)}.md`,sizeBytes:bytes.length,sha256:hash(bytes)},authorize);
  if(upload.ack)return upload.ack;for(let part=0;part<Math.ceil(bytes.length/FILE_PART_BYTES);part++)ctx.files.part(upload.uploadId,part,bytes.subarray(part*FILE_PART_BYTES,Math.min(bytes.length,(part+1)*FILE_PART_BYTES)),authorize);return ctx.files.commit(upload.uploadId,authorize,signal);
 }};
}
