import type {ContentEncryption} from '../content-encryption.js';
import {attachmentBinding} from './ingress-attachments.js';
import {randomUUID} from 'node:crypto';
import {forgottenFileSchema} from './ingress-file-forget.js';
import type {DatabaseSync} from 'node:sqlite';
import {existsSync,rmSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {privateDirectory} from '../private-storage.js';
import {z} from 'zod';
import {FILE_MAX_BYTES} from '@mote/shared';
import type {ScopedRuntime} from './http.js';
import type {DomainLifecycle,UserDataSubject,LifecyclePurpose,UserExport} from './lifecycle.js';
import {PrivateSql,PrivateDataError} from './private-data-sql.js';
import {Originals,identityHash,bytesHash} from './originals.js';
import {storedCaptureSchema} from './capture-original.js';
import {archivedImportFileSchema,archiveRelativePath} from '../archive-contract.js';
const domain='ingress',hash=z.string().regex(/^[a-f0-9]{64}$/),id=z.string().min(1).max(256);
const original=z.object({id:hash,source_id:id,capture_id:z.string().uuid(),hash,mime:z.string().max(200),retention:z.enum(['archive','snapshot'])}).strict();
const scope=z.object({capture_id:z.string().uuid(),source_id:id}).strict();
const object=z.object({hash,bytes:z.string().max(Math.ceil(FILE_MAX_BYTES/3)*4)}).strict();
const coverage={originals:true,captureScopes:true,devices:true,excluded:['upload-staging','active-authorizations','pins','tickets','workspaces','receipt-history']} as const;
const snapshot=z.object({id:hash,expires:z.number().int().nonnegative(),bytes:z.number().int().min(0).max(FILE_MAX_BYTES)}).strict();
const payloadSchema=z.object({format:z.literal('mote-ingress-v1'),fileRevisions:z.array(z.object({capture_id:z.string().uuid()}).strict()).optional(),forgottenFiles:z.array(forgottenFileSchema).optional(),attachmentLinks:z.array(z.object({capture_id:z.string().uuid(),parent_capture_id:z.string().uuid(),file_id:z.string().uuid()}).strict()).optional(),coverage:z.unknown().refine(value=>JSON.stringify(value)===JSON.stringify(coverage)),originals:z.array(original),scopes:z.array(scope),objects:z.array(object),archiveLinks:z.array(z.object({capture_id:z.string().uuid(),file_id:z.string().uuid()}).strict()).optional(),archivedFiles:z.array(z.object({id:z.string().uuid(),hash,json:z.string().max(8192)}).strict()).optional(),snapshots:z.array(snapshot).optional(),devices:z.array(z.object({id,json:z.string()}).strict())}).strict();
const invalid=()=>new PrivateDataError('invalid_data');

/** M16 composes this with private-data and execution. Physical failure is
 * retryable uncertainty, never a successful empty deletion/export. Portable
 * restore does not renew an account epoch or resume an upload authorization. */
export function ingressLifecycle(runtime:ScopedRuntime,db:DatabaseSync,directory:string,contentCipher?:(userId:string)=>ContentEncryption):DomainLifecycle{
 const bound=(subject:UserDataSubject,purpose:LifecyclePurpose)=>{
  const assert=()=>runtime.services.assertSubject(subject,domain,purpose),sql=new PrivateSql(db,subject.userId,assert);
  return {sql,assert,originals:new Originals(directory,subject.deploymentId,sql,assert,contentCipher?()=>contentCipher(subject.userId):undefined)};
 };
 const restore=(subject:UserDataSubject,archive:UserExport,operationId:string,merge=false)=>{
   const {sql,originals}=bound(subject,'restore');
   if(archive.domain!==domain||archive.version!==1||archive.userId!==subject.userId||archive.deploymentId!==subject.deploymentId)throw invalid();
   const payload=payloadSchema.parse(archive.payload),digest=identityHash(payload),files=payload.archivedFiles??[];
   const fileRevisions=payload.fileRevisions??[];if(new Set(fileRevisions.map(row=>row.capture_id)).size!==fileRevisions.length)throw invalid();for(const row of fileRevisions){const parent=sql.get('SELECT json FROM pd_captures WHERE user_id=$user AND id=?',row.capture_id);if(!parent)throw invalid();}
   const attachmentLinks=payload.attachmentLinks??[];if(new Set(attachmentLinks.map(row=>row.capture_id)).size!==attachmentLinks.length)throw invalid();
   const forgotten=payload.forgottenFiles??[];if(new Set(forgotten.map(row=>JSON.stringify([row.source_id,row.external_id]))).size!==forgotten.length)throw invalid();for(const row of forgotten)if(!sql.get('SELECT id FROM pd_sources WHERE user_id=$user AND id=?',row.source_id))throw invalid();
   // Complete validation precedes writes. M02 restores canonical parents first.
   const objects=new Map(payload.objects.map(item=>{const bytes=Buffer.from(item.bytes,'base64');if(bytes.toString('base64')!==item.bytes||bytes.length>FILE_MAX_BYTES||bytesHash(bytes)!==item.hash)throw invalid();return [item.hash,bytes] as const;}));
   if(objects.size!==payload.objects.length||new Set(payload.originals.map(row=>row.id)).size!==payload.originals.length||new Set(payload.originals.map(row=>JSON.stringify([row.source_id,row.capture_id]))).size!==payload.originals.length||new Set(payload.scopes.map(row=>row.capture_id)).size!==payload.scopes.length||new Set(payload.devices.map(row=>row.id)).size!==payload.devices.length)throw invalid();
   if(new Set(files.map(file=>file.id)).size!==files.length)throw invalid();
   for(const row of files){const file=archivedImportFileSchema.parse(JSON.parse(row.json));if(row.id!==file.id||row.hash!==file.hash||!objects.has(row.hash)||objects.get(row.hash)!.length!==file.sizeBytes||archiveRelativePath(file.relativePath)!==file.relativePath||file.name!==file.relativePath.split('/').at(-1)||/[\r\n\u0000]/.test(file.mimeType))throw invalid();}
   for(const link of payload.archiveLinks??[]){if(!files.some(file=>file.id===link.file_id)||!sql.get('SELECT id FROM pd_captures WHERE user_id=$user AND id=?',link.capture_id))throw invalid();}
   const scopes=new Map(payload.scopes.map(row=>[row.capture_id,row.source_id]));
   for(const row of [...payload.scopes,...payload.originals]){
    const parent=sql.get('SELECT json FROM pd_captures WHERE user_id=$user AND id=?',row.capture_id);
    if(!sql.get('SELECT id FROM pd_sources WHERE user_id=$user AND id=?',row.source_id)||!parent)throw invalid();
    const capture=storedCaptureSchema.parse(JSON.parse(String(parent.json))),canonicalSource=capture.provenance?.sourceId??capture.ingressSourceId;
    if(canonicalSource!==row.source_id||!capture.provenance&&scopes.get(row.capture_id)!==row.source_id)throw invalid();
    if(capture.source==='file'&&capture.provenance){const prior=sql.get('SELECT blocked FROM ig_file_forgets WHERE user_id=$user AND source_id=? AND external_id=?',row.source_id,capture.provenance.externalId),imported=forgotten.find(value=>value.source_id===row.source_id&&value.external_id===capture.provenance!.externalId);if(prior?.blocked||!prior&&imported?.blocked)throw new PrivateDataError('conflict',409);}
    if('hash' in row&&'mime' in row&&capture.originalImage&&(capture.originalImage.hash!==row.hash||capture.originalImage.mime!==row.mime))throw invalid();
   }
   const snapshots=new Map((payload.snapshots??[]).map(row=>[row.id,row]));if(snapshots.size!==(payload.snapshots??[]).length)throw invalid();
   for(const row of payload.originals){const state=snapshots.get(row.id);if((!objects.has(row.hash)&&(!state||state.expires>Date.now()))||state&&row.retention!=='snapshot'||state&&objects.has(row.hash)&&objects.get(row.hash)!.length!==state.bytes||row.id!==identityHash([subject.userId,row.source_id,row.capture_id,row.hash,row.mime,row.retention]))throw invalid();}
   if([...snapshots.keys()].some(id=>!payload.originals.some(row=>row.id===id))||[...objects.keys()].some(hash=>!payload.originals.some(row=>row.hash===hash)&&!files.some(row=>row.hash===hash)))throw invalid();
   const metadata=new Map<string,number>();for(const row of payload.originals){const size=objects.get(row.hash)?.length??snapshots.get(row.id)!.bytes;if(metadata.has(row.hash)&&metadata.get(row.hash)!==size)throw invalid();metadata.set(row.hash,size);}
   for(const row of payload.devices){const device=JSON.parse(row.json);if(device.id!==row.id||typeof device.name!=='string'||!['android','macos','windows','linux','import'].includes(device.platform))throw invalid();}
   const added=new Map<string,number>(),root=merge?originals.area('objects'):undefined;
   const rollback=()=>{if(!root)return;sql.transaction(()=>{for(const [hash,inode] of added){const path=join(root,hash);if(!existsSync(path))continue;if(sql.get("SELECT r.id FROM ig_originals r LEFT JOIN ig_snapshot_inputs s ON s.user_id=r.user_id AND s.original_id=r.id WHERE r.user_id=$user AND r.hash=? AND(r.retention='archive' OR s.original_id IS NULL OR s.expires>?) LIMIT 1",hash,Date.now())||sql.get('SELECT id FROM ig_archive_files WHERE user_id=$user AND hash=? LIMIT 1',hash)||sql.get('SELECT id FROM ig_pins WHERE user_id=$user AND hash=? AND expires>? LIMIT 1',hash,Date.now()))continue;privateDirectory(path);if(lstatSync(path).ino!==inode)throw new PrivateDataError('conflict',409);rmSync(path,{recursive:true});}});};
   try{sql.transaction(()=>{
    const prior=sql.get('SELECT digest FROM ig_restore WHERE user_id=$user AND operation_id=?',operationId);if(prior){if(prior.digest!==digest)throw new PrivateDataError('conflict',409);return;}
    if(!merge&&(sql.get('SELECT id FROM ig_originals WHERE user_id=$user LIMIT 1')||sql.get('SELECT capture_id FROM ig_capture_scopes WHERE user_id=$user LIMIT 1')||sql.get('SELECT id FROM ig_uploads WHERE user_id=$user LIMIT 1')||sql.get('SELECT id FROM ig_devices WHERE user_id=$user LIMIT 1')))throw new PrivateDataError('conflict',409);
    if(merge&&sql.get('SELECT id FROM ig_activity WHERE user_id=$user LIMIT 1'))throw new PrivateDataError('conflict',409);
    if(!merge&&sql.get('SELECT id FROM ig_archive_files WHERE user_id=$user LIMIT 1'))throw new PrivateDataError('conflict',409);
    for(const [hash,bytes] of objects){const path=root?join(root,hash):undefined,existed=path?existsSync(path):true;originals.put(bytes);if(path&&!existed)added.set(hash,lstatSync(path).ino);}
    for(const [hash,size] of metadata){const old=sql.get('SELECT bytes FROM ig_objects WHERE user_id=$user AND hash=?',hash);if(old&&old.bytes!==size)throw invalid();}
    for(const [hash,size] of metadata)if(!objects.has(hash)&&!sql.get('SELECT hash FROM ig_objects WHERE user_id=$user AND hash=?',hash)){
     // Expired metadata has no resident bytes. Publish its accounting credit
     // before its known size, atomically, so it cannot consume physical capacity.
     sql.run('INSERT INTO ig_objects VALUES($user,?,-1,0)',hash);sql.originalStorageResident(hash,false,size);
     sql.run('UPDATE ig_objects SET bytes=?,parts=? WHERE user_id=$user AND hash=?',size,Math.ceil(size/(4*1024*1024)),hash);
    }
    for(const row of files){const prior=sql.get('SELECT hash,json FROM ig_archive_files WHERE user_id=$user AND id=?',row.id);if(prior&&(prior.hash!==row.hash||prior.json!==row.json))throw new PrivateDataError('conflict',409);sql.run('INSERT INTO ig_archive_files VALUES($user,?,?,?) ON CONFLICT(user_id,id) DO NOTHING',row.id,row.hash,row.json);}
    for(const row of payload.archiveLinks??[])sql.run('INSERT OR IGNORE INTO ig_archive_links VALUES($user,?,?)',row.capture_id,row.file_id);
    for(const row of forgotten)sql.run('INSERT INTO ig_file_forgets(user_id,source_id,external_id,capture_id,generation,blocked,decision_id) VALUES($user,?,?,?,?,?,?) ON CONFLICT(user_id,source_id,external_id) DO NOTHING',row.source_id,row.external_id,row.capture_id,row.generation,row.blocked,randomUUID());
    for(const row of attachmentLinks){if(!payload.originals.some(original=>original.capture_id===row.capture_id)||!(payload.archiveLinks??[]).some(link=>link.capture_id===row.parent_capture_id&&link.file_id===row.file_id))throw invalid();sql.run('INSERT INTO ig_attachment_links VALUES($user,?,?,?,?) ON CONFLICT(user_id,capture_id) DO NOTHING',row.capture_id,row.parent_capture_id,row.file_id,randomUUID());}
    for(const row of payload.originals)sql.run('INSERT INTO ig_originals VALUES($user,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO NOTHING',row.id,row.source_id,row.capture_id,row.hash,row.mime,row.retention);
    for(const row of attachmentLinks)attachmentBinding(sql,row.capture_id,true);
    for(const state of snapshots.values())sql.run('INSERT INTO ig_snapshot_inputs VALUES($user,?,?) ON CONFLICT(user_id,original_id) DO NOTHING',state.id,state.expires);
    for(const row of fileRevisions)sql.run('INSERT OR IGNORE INTO ig_file_revisions VALUES($user,?)',row.capture_id);
    for(const row of payload.scopes){const old=sql.get('SELECT source_id FROM ig_capture_scopes WHERE user_id=$user AND capture_id=?',row.capture_id);if(old&&old.source_id!==row.source_id)throw invalid();sql.run('INSERT INTO ig_capture_scopes VALUES($user,?,?) ON CONFLICT(user_id,capture_id) DO NOTHING',row.capture_id,row.source_id);}
    for(const row of payload.devices){const old=sql.get('SELECT json FROM ig_devices WHERE user_id=$user AND id=?',row.id);if(old&&JSON.parse(String(old.json)).platform!==JSON.parse(row.json).platform)throw invalid();sql.run('INSERT INTO ig_devices VALUES($user,?,?) ON CONFLICT(user_id,id) DO NOTHING',row.id,row.json);}
    sql.run('INSERT INTO ig_state(user_id,deleted) VALUES($user,0) ON CONFLICT(user_id) DO UPDATE SET deleted=0');sql.run('INSERT INTO ig_restore VALUES($user,?,?)',operationId,digest);
   });}catch(error){try{rollback();}catch{/* Unpublished immutable objects remain owner-scoped for existing GC. */}throw error;}
   return rollback;
 };
 return {
  importUser:(subject,archive,operationId)=>restore(subject,archive,operationId,true),
  exportUser:async subject=>{
   const {sql,originals}=bound(subject,'export');return sql.transaction(()=>{
    const rows=sql.all('SELECT id,source_id,capture_id,hash,mime,retention FROM ig_originals WHERE user_id=$user ORDER BY id');
    const snapshots=sql.all('SELECT s.original_id id,s.expires,o.bytes FROM ig_snapshot_inputs s JOIN ig_originals r ON r.user_id=s.user_id AND r.id=s.original_id JOIN ig_objects o ON o.user_id=r.user_id AND o.hash=r.hash WHERE s.user_id=$user ORDER BY s.original_id').map(row=>({id:String(row.id),expires:Number(row.expires),bytes:Number(row.bytes)})),states=new Map(snapshots.map(row=>[row.id,row]));
    const archivedFiles=sql.all('SELECT id,hash,json FROM ig_archive_files WHERE user_id=$user ORDER BY id'),hashes=[...new Set([...rows.filter(row=>!states.has(String(row.id))||states.get(String(row.id))!.expires>Date.now()),...archivedFiles].map(row=>String(row.hash)))];
    return {domain,version:1,deploymentId:subject.deploymentId,userId:subject.userId,payload:{format:'mote-ingress-v1',fileRevisions:sql.all('SELECT capture_id FROM ig_file_revisions WHERE user_id=$user ORDER BY capture_id'),forgottenFiles:sql.all('SELECT source_id,external_id,capture_id,generation,blocked FROM ig_file_forgets WHERE user_id=$user ORDER BY source_id,external_id'),attachmentLinks:sql.all('SELECT capture_id,parent_capture_id,file_id FROM ig_attachment_links WHERE user_id=$user ORDER BY capture_id'),coverage,originals:rows,...(archivedFiles.length?{archivedFiles,archiveLinks:sql.all('SELECT capture_id,file_id FROM ig_archive_links WHERE user_id=$user ORDER BY capture_id,file_id')}:{}),...(snapshots.length?{snapshots}:{}),scopes:sql.all('SELECT capture_id,source_id FROM ig_capture_scopes WHERE user_id=$user ORDER BY capture_id'),objects:hashes.map(hash=>({hash,bytes:originals.readObject(hash).toString('base64')})),devices:sql.all('SELECT id,json FROM ig_devices WHERE user_id=$user ORDER BY id')}};
   });
  },
  deleteUser:async(subject,operationId)=>{
   const {sql,originals,assert}=bound(subject,'delete');sql.transaction(()=>{
    sql.run('INSERT INTO ig_state(user_id,deleted) VALUES($user,1) ON CONFLICT(user_id) DO UPDATE SET deleted=1');
    for(const table of ['ig_file_revisions','ig_attachment_links','ig_file_forget_operations','ig_file_forgets','ig_file_generations','ig_capture_updates','ig_capture_update_sequences','ig_import_uploads','ig_archive_links','ig_archive_files','ig_originals','ig_capture_scopes','ig_uploads','ig_batches','ig_devices','ig_pins','ig_work'])sql.run(`DELETE FROM ${table} WHERE user_id=$user`);
   });
   // A live or interrupted child can still own filesystem work. A crashed
   // activity requires M16 reconciliation; elapsed time is not erasure proof.
   if(sql.get('SELECT id FROM ig_activity WHERE user_id=$user LIMIT 1'))return {status:'result_unknown',operationId};
   try{assert();const path=originals.root();if(existsSync(path))rmSync(path,{recursive:true});assert();}
   catch{return {status:'result_unknown',operationId};}
   sql.transaction(()=>{sql.run('DELETE FROM ig_objects WHERE user_id=$user');sql.run('DELETE FROM ig_restore WHERE user_id=$user');});
   return {status:'complete',operationId};
  },
  restoreUser:async(subject,archive,operationId)=>{restore(subject,archive,operationId);},
 };
}
