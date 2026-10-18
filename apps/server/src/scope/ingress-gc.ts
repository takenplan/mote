import {PrivateDataError,type PrivateSql} from './private-data-sql.js';
import type {Originals} from './originals.js';

/** The generic import entry and scheduled maintenance share the same one-day
 * staging cleanup, including unlinked completed imports. Canonical import-job
 * and capture links protect retained files after the transport receipt expires.
 * An epoch change retires unfinished transport, not a completed original before
 * its existing staging deadline. */
export function collectImportUploads(sql:PrivateSql,originals:Originals,authorizationEpoch?:number){
 if(sql.originalActivity())return;
 const predicate=authorizationEpoch===undefined?'expires<=?':'(expires<=? OR(epoch<>? AND file_id IS NULL))';
 for(const row of sql.all(`SELECT id,stage_id,file_id FROM ig_import_uploads WHERE user_id=$user AND ${predicate}`,Date.now(),...(authorizationEpoch===undefined?[]:[authorizationEpoch]))){
  originals.cleanUpload(String(row.stage_id));sql.run('DELETE FROM ig_import_uploads WHERE user_id=$user AND id=?',String(row.id));
  if(row.file_id&&!sql.get('SELECT id FROM ig_import_uploads WHERE user_id=$user AND file_id=? LIMIT 1',String(row.file_id))&&!sql.get('SELECT file_id FROM ig_archive_links WHERE user_id=$user AND file_id=? LIMIT 1',String(row.file_id))){
   const jobs=sql.get("SELECT id FROM ig_archive_files WHERE user_id=$user AND id=? AND EXISTS(SELECT 1 FROM sqlite_master WHERE name='mp_import_files')",String(row.file_id));
   if(!jobs||!sql.get('SELECT file_id FROM mp_import_files WHERE user_id=$user AND file_id=? LIMIT 1',String(row.file_id)))sql.run('DELETE FROM ig_archive_files WHERE user_id=$user AND id=?',String(row.file_id));
  }
 }
}

/** One owner-bound collector shared by HTTP and host maintenance. An activity
 * journal is a physical hold, including an outcome the host cannot yet observe.
 * Its age never proves that a worker or external operation has stopped. */
export function collectIngress(sql:PrivateSql,originals:Originals,authorizationEpoch:number){
 return sql.transaction(()=>{
  if(sql.originalActivity())throw new PrivateDataError('conflict',409);
  for(const row of sql.all('SELECT id FROM ig_uploads WHERE user_id=$user AND (expires<=? OR authorization_epoch<>?)',Date.now(),authorizationEpoch)){
   originals.cleanUpload(String(row.id));sql.run('DELETE FROM ig_uploads WHERE user_id=$user AND id=?',String(row.id));
  }
  collectImportUploads(sql,originals,authorizationEpoch);
  for(const row of sql.all('SELECT id FROM ig_work WHERE user_id=$user AND expires<=?',Date.now())){
   originals.cleanWork(String(row.id));sql.run('DELETE FROM ig_work WHERE user_id=$user AND id=?',String(row.id));
  }
  return originals.gc();
 });
}
