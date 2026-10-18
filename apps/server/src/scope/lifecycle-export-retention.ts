import type {DatabaseSync} from 'node:sqlite';

/** Also used when an expired snapshot loses its bytes but keeps metadata. */
export function eraseExportCopies(db:DatabaseSync,userId:string){
 // Domain fixtures deliberately do not install the host lifecycle journal.
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='lifecycle_exports'").get())return;
 db.prepare("DELETE FROM lifecycle_exports WHERE operation_id IN(SELECT id FROM lifecycle_operations WHERE user_id=? AND kind='export')").run(userId);
 db.prepare("UPDATE lifecycle_operations SET state='failed',error='archive_changed',bytes=NULL,sha256=NULL,updated_at=? WHERE user_id=? AND kind='export' AND state='completed'").run(new Date().toISOString(),userId);
}

/** A canonical erasure fences any in-flight full-account response in the same
 * SQL transaction. Receipts contain metadata only; the existing content table
 * remains empty. User-held offline copies are outside this boundary.
 * Operational tables (pins, leases, queues and progress) are not erasures. */
export function installExportErasure(db:DatabaseSync){
 const contentTables=['pd_sources','pd_captures','pd_materials','pd_material_versions',
  'ig_originals','ig_archive_files','mp_artifacts','mp_publications','mp_file_annotations','mm_records','mm_versions','mm_evidence',
  'ma_conversations','ma_turns','ma_runs','ma_artifacts','mc_manifests','td_todos','ac_proposals','oq_questions'];
 for(const table of contentTables){
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))continue;
  db.exec(`CREATE TRIGGER IF NOT EXISTS lifecycle_erase_${table} AFTER DELETE ON ${table}
   BEGIN
    DELETE FROM lifecycle_exports WHERE operation_id IN(SELECT id FROM lifecycle_operations WHERE user_id=old.user_id AND kind='export');
    UPDATE lifecycle_operations SET state='failed',error='archive_changed',bytes=NULL,sha256=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE user_id=old.user_id AND kind='export' AND state='completed';
   END;`);
 }
}
