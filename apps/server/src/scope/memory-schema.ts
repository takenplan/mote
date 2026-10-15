import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {randomBytes} from 'node:crypto';

export const MEMORY_DOMAIN='memory';
const revision=z.string().regex(/^[a-f0-9]{64}$/);
export const memoryInputPinSchema=z.object({id:z.string().uuid(),hash:revision}).strict();
export const memoryBindingSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('builtin'),revision:z.number().int().positive()}).strict(),
 z.object({kind:z.literal('plugin'),revision:z.number().int().positive(),instanceId:z.string().min(1),snapshotId:z.string().uuid()}).strict(),
]);
export type ScopedMemoryBinding=z.infer<typeof memoryBindingSchema>;
export const memorySettingsSchema=z.object({automatic:z.boolean(),integration:z.boolean(),profile:z.enum(['personal','coding']),timeZone:z.string().refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}})}).strict();
export const defaultMemorySettings=()=>({automatic:false,integration:false,profile:'personal' as const,timeZone:'UTC'});
export const scopedMemoryTaskSchema=z.object({jobId:z.string().uuid(),phase:z.enum(['extract','integrate']),inputs:z.array(memoryInputPinSchema).min(1),related:z.array(z.object({id:z.string().uuid(),version:z.number().int().positive(),fingerprint:revision}).strict()),binding:memoryBindingSchema,generation:z.number().int().nonnegative(),deletionSnapshot:revision,automatic:z.boolean(),profile:z.enum(['personal','coding']),timeZone:z.string()}).strict();
export type ScopedMemoryTask=z.infer<typeof scopedMemoryTaskSchema>;

/** One shared database. Every private key and relationship starts with the
 * host owner; identical material, evidence and memory IDs remain independent. */
export function installScopedMemory(db:DatabaseSync){
 db.exec(`CREATE TABLE IF NOT EXISTS mm_meta(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,cursor_key TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS mm_state(user_id TEXT PRIMARY KEY,deleted INTEGER NOT NULL DEFAULT 0,generation INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,desired INTEGER NOT NULL DEFAULT 1,settings TEXT NOT NULL,binding TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS mm_evidence(user_id TEXT NOT NULL,id TEXT NOT NULL,material_id TEXT NOT NULL,material_revision TEXT NOT NULL,block_id TEXT NOT NULL,hash TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,id),UNIQUE(user_id,material_id,material_revision,block_id),FOREIGN KEY(user_id,material_id,material_revision) REFERENCES pd_material_versions(user_id,material_id,revision) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS mm_records(user_id TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,fingerprint TEXT NOT NULL,body_digest TEXT NOT NULL,binding TEXT NOT NULL,json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS mm_versions(user_id TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,fingerprint TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,id,version),FOREIGN KEY(user_id,id) REFERENCES mm_records(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS mm_dependencies(user_id TEXT NOT NULL,memory_id TEXT NOT NULL,evidence_id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(user_id,memory_id,evidence_id),FOREIGN KEY(user_id,memory_id) REFERENCES mm_records(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS mm_jobs(user_id TEXT NOT NULL,id TEXT NOT NULL,input TEXT NOT NULL,draft TEXT,review TEXT,prepared TEXT,state TEXT NOT NULL DEFAULT 'admitting',tasks TEXT NOT NULL DEFAULT '{}',PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS mm_provider_journal(user_id TEXT NOT NULL,id TEXT NOT NULL,job_id TEXT NOT NULL,namespace TEXT NOT NULL,key_json TEXT NOT NULL,body_digest TEXT NOT NULL,payload_digest TEXT NOT NULL,state TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS mm_deletions(user_id TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS mm_commands(user_id TEXT NOT NULL,id TEXT NOT NULL,fingerprint TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS mm_restore(user_id TEXT NOT NULL,id TEXT NOT NULL,fingerprint TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE VIRTUAL TABLE IF NOT EXISTS mm_fts USING fts5(user_id UNINDEXED,id UNINDEXED,text,tokenize='trigram');
 CREATE TRIGGER IF NOT EXISTS mm_index_insert AFTER INSERT ON mm_records BEGIN INSERT INTO mm_fts VALUES(new.user_id,new.id,json_extract(new.json,'$.title')||' '||json_extract(new.json,'$.statement')); END;
 CREATE TRIGGER IF NOT EXISTS mm_index_update AFTER UPDATE ON mm_records BEGIN DELETE FROM mm_fts WHERE user_id=old.user_id AND id=old.id;INSERT INTO mm_fts VALUES(new.user_id,new.id,json_extract(new.json,'$.title')||' '||json_extract(new.json,'$.statement')); END;
 CREATE TRIGGER IF NOT EXISTS mm_index_delete AFTER DELETE ON mm_records BEGIN DELETE FROM mm_fts WHERE user_id=old.user_id AND id=old.id; END;
 CREATE TRIGGER IF NOT EXISTS mm_material_deleted BEFORE DELETE ON pd_materials BEGIN UPDATE mm_records SET json=json_set(json,'$.status','stale','$.staleReason','evidence_changed') WHERE user_id=old.user_id AND id IN(SELECT d.memory_id FROM mm_dependencies d JOIN mm_evidence e ON e.user_id=d.user_id AND e.id=d.evidence_id WHERE d.user_id=old.user_id AND e.material_id=old.id); END;
 CREATE TRIGGER IF NOT EXISTS mm_material_changed AFTER UPDATE OF revision,min_visible_sequence ON pd_materials WHEN new.revision!=old.revision OR new.min_visible_sequence!=old.min_visible_sequence BEGIN UPDATE mm_records SET json=json_set(json,'$.status','stale','$.staleReason','evidence_changed') WHERE user_id=new.user_id AND id IN(SELECT d.memory_id FROM mm_dependencies d JOIN mm_evidence e ON e.user_id=d.user_id AND e.id=d.evidence_id WHERE d.user_id=new.user_id AND e.material_id=new.id AND (e.material_revision!=new.revision OR new.sequence<new.min_visible_sequence)); END;`);
 db.prepare('INSERT OR IGNORE INTO mm_meta VALUES(1,1,?)').run(randomBytes(32).toString('hex'));
 const meta=db.prepare('SELECT * FROM mm_meta WHERE id=1').get();if(meta?.version!==1||typeof meta.cursor_key!=='string'||!/^[a-f0-9]{64}$/.test(meta.cursor_key))throw new Error('Memory schema unavailable');return meta.cursor_key;
}
