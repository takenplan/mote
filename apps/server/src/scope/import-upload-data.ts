import {randomUUID} from 'node:crypto';
import {basename} from 'node:path';
import type {ArchivedFile} from '@mote/shared';
import {FILE_PART_BYTES} from '@mote/shared';
import {importUploadManifestSchema,archivedImportFileSchema,archiveRelativePath} from '../archive-contract.js';
import {PrivateDataError,missing,type PrivateSql} from './private-data-sql.js';
import {bytesHash,type Originals} from './originals.js';

/** Called only after M03 has verified and retained the whole original object. */
export function recordArchivedFile(sql:PrivateSql,hash:string,name:string,sizeBytes:number,mimeType='application/octet-stream'):ArchivedFile{
 const relativePath=archiveRelativePath(name);mimeType=mimeType.trim()||'application/octet-stream';if(/[\r\n\u0000]/.test(mimeType))throw new PrivateDataError('invalid_data');
 const prior=sql.get("SELECT json FROM ig_archive_files WHERE user_id=$user AND hash=? AND json_extract(json,'$.relativePath')=? AND json_extract(json,'$.mimeType')=?",hash,relativePath,mimeType);
 const value:ArchivedFile=prior?archivedImportFileSchema.parse(JSON.parse(String(prior.json))):{id:randomUUID(),hash,name:basename(relativePath),relativePath,mimeType,sizeBytes,createdAt:new Date().toISOString()};
 if(!prior)sql.run('INSERT INTO ig_archive_files VALUES($user,?,?,?)',value.id,value.hash,JSON.stringify(value));return value;
}

/** Existing M03 storage/worker with the original generic import wire contract.
 * This is private staging, never a capture, Material, processor or executor. */
export function importUploadData(sql:PrivateSql,originals:Originals,epoch:number,admit:()=>void,during:<T>(work:()=>Promise<T>)=>Promise<T>,serialize:<T>(id:string,work:()=>Promise<T>)=>Promise<T>){
 const conflict=()=>new PrivateDataError('conflict',409);
 const file=(id:string):ArchivedFile=>{const row=sql.get('SELECT id,hash,json FROM ig_archive_files WHERE user_id=$user AND id=?',id);if(!row)throw missing();const value=archivedImportFileSchema.parse(JSON.parse(String(row.json)));if(value.id!==row.id||value.hash!==row.hash||archiveRelativePath(value.relativePath)!==value.relativePath||basename(value.relativePath)!==value.name)throw new PrivateDataError('invalid_data');return value;};
 const upload=(id:string)=>{admit();const row=sql.get('SELECT * FROM ig_import_uploads WHERE user_id=$user AND id=?',id);if(!row)throw missing();if(row.epoch!==epoch||Number(row.expires)<=Date.now())throw conflict();return row;};
 return Object.freeze({
  begin:(value:unknown)=>sql.transaction(()=>{
   admit();const parsed=importUploadManifestSchema.parse(value),{id=randomUUID(),...manifest}=parsed;archiveRelativePath(manifest.name);
   // Preserve the original one-day staging policy. A running M03 worker owns
   // its parts until it settles; cleanup never races its private filesystem.
   if(!sql.get('SELECT id FROM ig_activity WHERE user_id=$user LIMIT 1')){
    for(const row of sql.all('SELECT id,stage_id,file_id FROM ig_import_uploads WHERE user_id=$user AND expires<=?',Date.now())){
     originals.cleanUpload(String(row.stage_id));sql.run('DELETE FROM ig_import_uploads WHERE user_id=$user AND id=?',String(row.id));
     if(row.file_id&&!sql.get('SELECT id FROM ig_import_uploads WHERE user_id=$user AND file_id=? LIMIT 1',String(row.file_id))&&!sql.get('SELECT file_id FROM ig_archive_links WHERE user_id=$user AND file_id=? LIMIT 1',String(row.file_id))){
      const jobs=sql.get("SELECT id FROM ig_archive_files WHERE user_id=$user AND id=? AND EXISTS(SELECT 1 FROM sqlite_master WHERE name='mp_import_files')",String(row.file_id));
      if(!jobs||!sql.get('SELECT file_id FROM mp_import_files WHERE user_id=$user AND file_id=? LIMIT 1',String(row.file_id)))sql.run('DELETE FROM ig_archive_files WHERE user_id=$user AND id=?',String(row.file_id));
     }
    }
   }
   const prior=sql.get('SELECT manifest FROM ig_import_uploads WHERE user_id=$user AND id=?',id);
   if(prior&&String(prior.manifest)!==JSON.stringify(manifest))throw conflict();
   if(!prior)sql.run('INSERT INTO ig_import_uploads VALUES($user,?,?,?,?,?,NULL)',id,randomUUID(),JSON.stringify(manifest),epoch,Date.now()+86400000);
   const row=upload(id);return {id,partBytes:FILE_PART_BYTES,...(row.file_id?{fileId:row.file_id}:{}),parts:sql.all('SELECT part,bytes,checksum AS hash FROM ig_import_parts WHERE user_id=$user AND upload_id=? ORDER BY part',id)};
  }),
  part:(id:string,part:number,bytes:Buffer)=>sql.transaction(()=>{
   const row=upload(id),manifest=importUploadManifestSchema.parse(JSON.parse(String(row.manifest))),expected=Math.min(FILE_PART_BYTES,manifest.sizeBytes-part*FILE_PART_BYTES);
   if(!Buffer.isBuffer(bytes)||!Number.isSafeInteger(part)||part<0||part>=Math.ceil(manifest.sizeBytes/FILE_PART_BYTES)||bytes.length!==expected)throw new PrivateDataError('invalid_data');
   const hash=bytesHash(bytes),prior=sql.get('SELECT checksum FROM ig_import_parts WHERE user_id=$user AND upload_id=? AND part=?',id,part);
   if(prior){if(prior.checksum!==hash)throw conflict();return {part,bytes:bytes.length,hash};}if(row.file_id)throw conflict();
   originals.writePart(String(row.stage_id),part,bytes);sql.run('INSERT INTO ig_import_parts VALUES($user,?,?,?,?)',id,part,hash,bytes.length);return {part,bytes:bytes.length,hash};
  }),
  commit:(id:string)=>serialize(id,()=>during(async()=>{
   const row=upload(id);if(row.file_id)return file(String(row.file_id));
   const manifest=importUploadManifestSchema.parse(JSON.parse(String(row.manifest))),parts=sql.all('SELECT part,checksum,bytes FROM ig_import_parts WHERE user_id=$user AND upload_id=? ORDER BY part',id).map(row=>({part:Number(row.part),hash:String(row.checksum),bytes:Number(row.bytes)}));
   if(parts.length!==Math.ceil(manifest.sizeBytes/FILE_PART_BYTES))throw conflict();
   const prepared=await originals.prepareArchive(String(row.stage_id),manifest.sizeBytes,parts);
   const result=sql.transaction(()=>{
    const current=upload(id);if(current.file_id)return file(String(current.file_id));
    const value=recordArchivedFile(sql,prepared.hash,manifest.name,manifest.sizeBytes,manifest.mimeType);
    sql.run('UPDATE ig_import_uploads SET file_id=? WHERE user_id=$user AND id=?',value.id,id);sql.run('DELETE FROM ig_import_parts WHERE user_id=$user AND upload_id=?',id);return value;
   });originals.cleanUpload(String(row.stage_id));return result;
  })),
  file,
  bytes:(id:string)=>{const value=file(id),bytes=originals.readObject(value.hash);if(bytes.length!==value.sizeBytes)throw conflict();return bytes;},
 });
}
