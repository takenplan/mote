import type {CaptureRecord} from '@mote/shared';
import {AskEvidence} from './ask-evidence.js';
import type {PrivateData} from './private-data.js';
import {PrivateDataError,missing,type PrivateSql,type PrivateCursor} from './private-data-sql.js';

/** A manual task references an owned archived record; it does not disclose its
 * body to a model or grant permission to process an archive/reference original.
 * Query-visible Material citations keep their existing complete proof checks. */
export function assertTodoEvidence(sql:PrivateSql,data:PrivateData,cursor:PrivateCursor,assertCurrent:()=>void,ids:readonly string[]){
 if(new Set(ids).size!==ids.length)throw new PrivateDataError('invalid_data');
 let canonical:AskEvidence|undefined;
 for(const id of ids){
  assertCurrent();let record:CaptureRecord;
  try{record=data.capture(id);}catch(error){
   if(!(error instanceof PrivateDataError)||error.code!=='not_found')throw error;
   canonical??=new AskEvidence(sql,data,cursor,{assertCurrent});canonical.evidence([id]);continue;
  }
  const sourceId=record.provenance?.sourceId??sql.get('SELECT source_id FROM ig_capture_scopes WHERE user_id=$user AND capture_id=?',id)?.source_id;
  if(typeof sourceId!=='string'||!data.source(sourceId).enabled||record.privacy.excluded||record.privacy.redacted)throw missing();
  const provenance=record.provenance;
  if(provenance&&(provenance.deleted||data.sourceItem(sourceId,provenance.externalId)?.captureId!==id))throw missing();
 }
}
