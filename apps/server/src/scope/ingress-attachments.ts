import {missing,type PrivateSql} from './private-data-sql.js';

/** M03's exact retained attachment relation, applied before bounded read LIMITs.
 * A JSON declaration alone is never a byte capability. No caller SQL is used. */
export const attachmentVisible=(capture='c',live=true)=>`(json_type(${capture}.json,'$.provenance.document.attachmentOf') IS NULL OR EXISTS(
 SELECT 1 FROM ig_attachment_links l JOIN pd_captures p ON p.user_id=l.user_id AND p.id=l.parent_capture_id
 LEFT JOIN pd_source_heads ph ON ph.user_id=p.user_id AND ph.capture_id=p.id
 JOIN pd_sources ps ON ps.user_id=p.user_id AND ps.id=p.source_id
 JOIN ig_archive_links a ON a.user_id=l.user_id AND a.capture_id=p.id AND a.file_id=l.file_id
 JOIN ig_archive_files f ON f.user_id=a.user_id AND f.id=a.file_id
 JOIN ig_originals r ON r.user_id=l.user_id AND r.capture_id=l.capture_id
 JOIN ig_objects o ON o.user_id=r.user_id AND o.hash=r.hash
 WHERE l.user_id=${capture}.user_id AND l.capture_id=${capture}.id
 AND p.id=json_extract(${capture}.json,'$.provenance.document.attachmentOf.captureId')
 AND f.id=json_extract(${capture}.json,'$.provenance.document.attachmentOf.fileId')
 AND p.source_id=${capture}.source_id AND r.source_id=p.source_id AND f.hash=r.hash
 AND o.bytes=json_extract(f.json,'$.sizeBytes')
 AND (json_extract(f.json,'$.mimeType')='application/octet-stream' OR json_extract(f.json,'$.mimeType')=r.mime)
 ${live?"AND ph.capture_id IS NOT NULL AND COALESCE(json_extract(p.json,'$.provenance.deleted'),0)=0 AND COALESCE(json_extract(p.json,'$.privacy.excluded'),0)=0 AND COALESCE(json_extract(ps.json,'$.enabled'),1)=1":''}
 AND json_type(p.json,'$.provenance.document.attachmentOf') IS NULL
 AND EXISTS(SELECT 1 FROM json_each(p.json,'$.provenance.document.attachments') d WHERE json_extract(d.value,'$.id')=f.id)))`;

export function attachmentBinding(sql:PrivateSql,captureId:string,retained=false){
 const row=sql.get(`SELECT c.json,l.binding_id,l.parent_capture_id,l.file_id FROM pd_captures c
 LEFT JOIN ig_attachment_links l ON l.user_id=c.user_id AND l.capture_id=c.id
 WHERE c.user_id=$user AND c.id=? AND ${attachmentVisible('c',!retained)}`,captureId);if(!row)throw missing();
 return row.binding_id?{id:String(row.binding_id),parentId:String(row.parent_capture_id),fileId:String(row.file_id)}:undefined;
}
export function attachmentOriginalBinding(sql:PrivateSql,ref:string){const row=sql.get('SELECT capture_id FROM ig_originals WHERE user_id=$user AND id=?',ref.slice(9));if(!row)throw missing();return attachmentBinding(sql,String(row.capture_id));}
