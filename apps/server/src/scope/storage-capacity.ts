import type {DatabaseSync} from 'node:sqlite';
import {StorageLedger} from '../storage-ledger.js';
import {StoreError} from '../execution-storage.js';
import type {Configurations} from './configuration.js';

const jsonTables=['pd_sources','pd_captures','pd_material_versions','pd_material_declarations','ig_archive_files','ig_devices','ig_upload_imports','mp_file_plans','mp_import_jobs','mp_import_records','mp_artifacts','mp_file_reviews','mp_file_annotations','mm_evidence','mm_records','mm_versions','mm_capture_intakes','mm_intakes','mm_integration_windows','mm_feedback','mm_provider_journal','mm_deletions','ma_artifacts','ma_traces','ma_insight_snapshots','td_todos','ac_proposals','ac_targets','user_model_usage'];
const expressions:Record<string,string>={...Object.fromEntries(jsonTables.map(table=>[table,'length(CAST(json AS BLOB))'])),
 scoped_storage_evictions:'-bytes',ig_objects:'MAX(bytes,0)',ig_upload_parts:'bytes',ig_import_parts:'bytes',ig_uploads:'length(CAST(manifest AS BLOB))',ig_import_uploads:'length(CAST(manifest AS BLOB))',ig_batches:'length(CAST(receipt AS BLOB))',
 pd_source_contexts:'length(CAST(description AS BLOB))',pd_import_declarations:'length(CAST(instruction AS BLOB))',
 ma_turns:'length(CAST(input AS BLOB))+length(CAST(result AS BLOB))',ma_runs:'length(CAST(input AS BLOB))+COALESCE(length(CAST(result AS BLOB)),0)'};
// Admission belongs to incoming originals and canonical metadata. Deletion,
// revocation and their receipts must remain possible when an instance is full.
const admission=['pd_captures','pd_material_versions','pd_sources','pd_material_declarations','ig_archive_files','ig_objects','ig_upload_parts','ig_import_parts','ig_uploads','ig_import_uploads'];
const capacities=new WeakMap<DatabaseSync,ScopedStorageCapacity>();
export const isStorageLimit=(error:unknown)=>error instanceof Error&&error.message==='mote_storage_limit';
export function reserveStorage(db:DatabaseSync,bytes:number){capacities.get(db)?.reserve(bytes);}
export function reserveStorageObject(db:DatabaseSync,userId:string,hash:string,bytes:number,prior:number){capacities.get(db)?.reserveObject(userId,hash,bytes,prior);}
export function originalStorageResident(db:DatabaseSync,userId:string,hash:string,resident:boolean,bytes:number){capacities.get(db)?.resident(userId,hash,resident,bytes);}
export function reserveStoragePart(db:DatabaseSync,userId:string,stageId:string,bytes:number){capacities.get(db)?.reservePart(userId,stageId,bytes);}
export function preparedImportStorage(db:DatabaseSync,userId:string,stageId:string,hash:string){capacities.get(db)?.preparedImport(userId,stageId,hash);}
const ledgerTotal="(SELECT COALESCE(SUM(bytes),0) FROM storage_ledger WHERE name NOT IN ('blobs','file_blobs','file_objects'))";
const duplicateParts='(SELECT COALESCE(SUM(p.bytes),0) FROM scoped_storage_staged_parts p JOIN ig_objects o ON o.user_id=p.user_id AND o.hash=p.hash AND o.bytes>=0 AND NOT EXISTS(SELECT 1 FROM scoped_storage_evictions e WHERE e.user_id=o.user_id AND e.hash=o.hash))';
const logicalTotal=`(${ledgerTotal}-${duplicateParts})`;


/** One instance ledger across owner namespaces; no per-account quota. The
 * shared ledger counts logical payloads, excluding indexes, WAL and encryption
 * overhead, exactly as the original capacity policy. SQL enforces admission
 * inside the writer transaction, including other SQLite connections. */
export class ScopedStorageCapacity{
 private readonly ledger:StorageLedger;
 private readonly unsubscribe:()=>void;
 constructor(private readonly db:DatabaseSync,configuration:Configurations){
  this.ledger=new StorageLedger(db,expressions);this.ledger.bytes();
  db.exec(`CREATE TABLE IF NOT EXISTS scoped_storage_capacity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),max_bytes INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS scoped_storage_evictions(user_id TEXT NOT NULL,hash TEXT NOT NULL,bytes INTEGER NOT NULL,PRIMARY KEY(user_id,hash),FOREIGN KEY(user_id,hash) REFERENCES ig_objects(user_id,hash) ON DELETE CASCADE);
   CREATE TABLE IF NOT EXISTS scoped_storage_prepared_imports(user_id TEXT NOT NULL,upload_id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(user_id,upload_id),FOREIGN KEY(user_id,upload_id) REFERENCES ig_import_uploads(user_id,id) ON DELETE CASCADE);
   CREATE VIEW IF NOT EXISTS scoped_storage_staged_parts AS
    SELECT p.user_id,p.bytes,json_extract(u.manifest,'$.sha256') hash FROM ig_upload_parts p JOIN ig_uploads u ON u.user_id=p.user_id AND u.id=p.upload_id
    UNION ALL SELECT p.user_id,p.bytes,t.hash FROM ig_import_parts p JOIN scoped_storage_prepared_imports t ON t.user_id=p.user_id AND t.upload_id=p.upload_id;`);
  const apply=()=>db.prepare('INSERT INTO scoped_storage_capacity VALUES(1,?) ON CONFLICT(singleton) DO UPDATE SET max_bytes=excluded.max_bytes').run(configuration.instance.current<{maxStorageBytes:number}>('storage').maxStorageBytes);
  apply();this.unsubscribe=configuration.instance.onChange(apply);
  const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>String(row.name)));
  for(const table of admission){if(!tables.has(table))continue;
   const columns=db.prepare(`PRAGMA table_info(${table})`).all().map(row=>String(row.name));
   const qualify=(prefix:string)=>expressions[table].replace(/\b[a-z_]+\b/g,word=>columns.includes(word)?`${prefix}.${word}`:word);
   const primary=db.prepare(`PRAGMA table_info(${table})`).all().filter(row=>Number(row.pk)>0).map(row=>String(row.name));
   const prior=`COALESCE((SELECT ${expressions[table]} FROM ${table} WHERE ${primary.map(column=>`${column}=new.${column}`).join(' AND ')}),0)`;
   for(const event of ['INSERT','UPDATE'] as const){
    // Changing source privacy/enablement remains available even above capacity.
    if(table==='pd_sources'&&event==='UPDATE')continue;
    let delta=event==='INSERT'?`(${qualify('new')})-(${prior})`:`(${qualify('new')})-(${qualify('old')})`;
    if(table==='ig_objects')delta=`(${delta})-CASE WHEN ${event==='INSERT'?prior:'MAX(old.bytes,0)'}=0 AND new.bytes>=0 THEN (SELECT COALESCE(SUM(p.bytes),0) FROM scoped_storage_staged_parts p WHERE p.user_id=new.user_id AND p.hash=new.hash) ELSE 0 END`;
    if(table==='ig_upload_parts'||table==='ig_import_parts'){
     const hash=table==='ig_upload_parts'?"SELECT json_extract(manifest,'$.sha256') FROM ig_uploads WHERE user_id=new.user_id AND id=new.upload_id":'SELECT hash FROM scoped_storage_prepared_imports WHERE user_id=new.user_id AND upload_id=new.upload_id';
     delta=`CASE WHEN EXISTS(SELECT 1 FROM ig_objects WHERE user_id=new.user_id AND hash=(${hash}) AND bytes>=0 AND NOT EXISTS(SELECT 1 FROM scoped_storage_evictions e WHERE e.user_id=new.user_id AND e.hash=ig_objects.hash)) THEN 0 ELSE (${delta}) END`;
    }
    db.exec(`CREATE TRIGGER IF NOT EXISTS scoped_capacity_${table}_${event.toLowerCase()} BEFORE ${event} ON ${table}
     WHEN (${delta})>0 AND (SELECT max_bytes FROM scoped_storage_capacity WHERE singleton=1)>0
      AND ${logicalTotal}+(${delta})>(SELECT max_bytes FROM scoped_storage_capacity WHERE singleton=1)
     BEGIN SELECT RAISE(ABORT,'mote_storage_limit'); END;`);
   }
  }this.ledger.bytes();capacities.set(db,this);
 }
 reserve(bytes:number){const limit=Number(this.db.prepare('SELECT max_bytes FROM scoped_storage_capacity WHERE singleton=1').get()!.max_bytes);if(bytes>=0&&limit>0&&this.bytes()+bytes>limit)throw new StoreError('Vault storage limit reached',507);}
 preparedImport(userId:string,stageId:string,hash:string){this.db.prepare('INSERT INTO scoped_storage_prepared_imports SELECT user_id,id,? FROM ig_import_uploads WHERE user_id=? AND stage_id=? ON CONFLICT(user_id,upload_id) DO UPDATE SET hash=excluded.hash').run(hash,userId,stageId);}
 reserveObject(userId:string,hash:string,bytes:number,prior:number){const evicted=this.db.prepare('SELECT 1 FROM scoped_storage_evictions WHERE user_id=? AND hash=?').get(userId,hash);const staged=evicted||prior<=0?Number(this.db.prepare('SELECT COALESCE(SUM(bytes),0) n FROM scoped_storage_staged_parts WHERE user_id=? AND hash=?').get(userId,hash)!.n):0;this.reserve(Math.max(0,bytes-(evicted?0:prior)-staged));}
 resident(userId:string,hash:string,resident:boolean,bytes:number){
  if(resident){const changed=this.db.prepare('DELETE FROM scoped_storage_evictions WHERE user_id=? AND hash=?').run(userId,hash);if(changed.changes)this.reserve(0);}
  else this.db.prepare('INSERT INTO scoped_storage_evictions VALUES(?,?,?) ON CONFLICT(user_id,hash) DO UPDATE SET bytes=excluded.bytes').run(userId,hash,bytes);
 }
 reservePart(userId:string,stageId:string,bytes:number){
  const existing=this.db.prepare(`SELECT 1 FROM ig_objects o WHERE o.user_id=? AND o.bytes>=0 AND NOT EXISTS(SELECT 1 FROM scoped_storage_evictions e WHERE e.user_id=o.user_id AND e.hash=o.hash) AND(o.hash=(SELECT json_extract(manifest,'$.sha256') FROM ig_uploads WHERE user_id=? AND id=?) OR o.hash=(SELECT t.hash FROM scoped_storage_prepared_imports t JOIN ig_import_uploads u ON u.user_id=t.user_id AND u.id=t.upload_id WHERE u.user_id=? AND u.stage_id=?)) LIMIT 1`).get(userId,userId,stageId,userId,stageId);
  if(!existing)this.reserve(bytes);
 }
 bytes(){this.ledger.bytes();return Number(this.db.prepare(`SELECT ${logicalTotal} n`).get()!.n);}
 close(){this.unsubscribe();capacities.delete(this.db);}
}
