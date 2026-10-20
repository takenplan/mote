import type {DatabaseSync} from 'node:sqlite';
import type {UserContext} from './context.js';
import {PrivateSql} from './private-data-sql.js';

/** Count current canonical archive facts through the existing owner-bound SQL
 * gateway. No provider read, task admission or whole-source page scan is needed. */
export function recordingArchiveCounts(db:DatabaseSync,context:UserContext,sourceId:string,assert:()=>void){
 const sql=new PrivateSql(db,context.userId,assert),counts=sql.get(`SELECT
  COALESCE(sum(CASE WHEN f.format IN ('processor:connector.feishu-transcript','processor:connector.dingtalk-transcript')
   AND COALESCE(json_extract(c.json,'$.provenance.document.originalMetadata.empty'),0)=0
   AND COALESCE(json_extract(c.json,'$.provenance.document.originalMetadata.formatError'),'')='' THEN 1 ELSE 0 END),0) transcripts,
  COALESCE(sum(CASE WHEN f.format='recording-audio-backup' THEN 1 ELSE 0 END),0) audio,
  COALESCE(sum(CASE WHEN f.format IN ('processor:connector.feishu-transcript','processor:connector.dingtalk-transcript')
   AND json_extract(c.json,'$.provenance.document.originalMetadata.empty')=1 THEN 1 ELSE 0 END),0) empty
  FROM pd_source_heads h JOIN pd_captures c ON c.user_id=h.user_id AND c.id=h.capture_id
  JOIN ig_originals r ON r.user_id=h.user_id AND r.capture_id=h.capture_id
  JOIN mp_original_formats f ON f.user_id=r.user_id AND f.original_id=r.id
  WHERE h.user_id=$user AND h.source_id=? AND COALESCE(json_extract(c.json,'$.provenance.deleted'),0)=0`,sourceId)!;
 return {transcripts:Number(counts.transcripts),audio:Number(counts.audio),empty:Number(counts.empty)};
}
