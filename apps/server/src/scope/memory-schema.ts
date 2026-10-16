import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {randomBytes} from 'node:crypto';
import {memoryRecipeBindingSchema,memoryIntegrationBindingSchema,memoryStrategyRefSchema} from '../memory-strategy-contract.js';
import {RANGE_SELECTION_PERSONAL_RECIPE,RANGE_SELECTION_CODING_RECIPE,RANGE_SELECTION_DAILY_RECIPE} from '../memory-range-selection-policy.js';
import {defaultMemoryIntegrationRecipe} from '../memory-integration-policy.js';
import {lifecycleSettingsSchema,defaultLifecycleSettings} from '../memory-configuration.js';

export const MEMORY_DOMAIN='memory';
export class ScopedMemoryError extends Error{constructor(readonly code:'memory_provider_unavailable'|'memory_provider_invalid_record'|'memory_provider_result_unknown'|'memory_provider_unsupported_input',readonly statusCode=503){super(code);}}
const revision=z.string().regex(/^[a-f0-9]{64}$/);
export const memoryInputPinSchema=z.object({id:z.string().uuid(),hash:revision}).strict();
export const memoryBindingSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('builtin'),revision:z.number().int().positive()}).strict(),
 z.object({kind:z.literal('plugin'),revision:z.number().int().positive(),instanceId:z.string().min(1),snapshotId:z.string().uuid()}).strict(),
]);
export type ScopedMemoryBinding=z.infer<typeof memoryBindingSchema>;
const recipeSelections=z.array(memoryStrategyRefSchema).min(1).max(10).refine(items=>new Set(items.map(item=>item.id+'@'+item.version)).size===items.length);
export const memorySettingsSchema=z.object({recipes:recipeSelections.optional(),captureRecipes:recipeSelections.default([RANGE_SELECTION_PERSONAL_RECIPE,RANGE_SELECTION_DAILY_RECIPE]),documentRecipes:recipeSelections.default([RANGE_SELECTION_PERSONAL_RECIPE,RANGE_SELECTION_DAILY_RECIPE]),sourceRecipes:z.record(recipeSelections).default({}),automatic:z.boolean(),integration:z.boolean(),profile:z.enum(['personal','coding']),recipe:memoryStrategyRefSchema.default(RANGE_SELECTION_PERSONAL_RECIPE),codingRecipe:memoryStrategyRefSchema.default(RANGE_SELECTION_CODING_RECIPE),integrationRecipe:memoryStrategyRefSchema.default(defaultMemoryIntegrationRecipe),lifecycle:lifecycleSettingsSchema.default(defaultLifecycleSettings),timeZone:z.string().refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}})}).strict();
export const defaultMemorySettings=()=>structuredClone({captureRecipes:[RANGE_SELECTION_PERSONAL_RECIPE,RANGE_SELECTION_DAILY_RECIPE],documentRecipes:[RANGE_SELECTION_PERSONAL_RECIPE,RANGE_SELECTION_DAILY_RECIPE],sourceRecipes:{},automatic:true,integration:true,profile:'personal' as const,recipe:RANGE_SELECTION_PERSONAL_RECIPE,codingRecipe:RANGE_SELECTION_CODING_RECIPE,integrationRecipe:defaultMemoryIntegrationRecipe,lifecycle:defaultLifecycleSettings,timeZone:'UTC'});
export const scopedMemoryTaskSchema=z.object({jobId:z.string().uuid(),action:z.literal('owner-correction').optional(),batchId:z.string().uuid().optional(),ranges:z.array(z.object({id:z.string().uuid(),offset:z.number().int().nonnegative(),length:z.number().int().positive().max(12000)}).strict()).optional(),model:z.object({snapshotId:z.string().uuid(),operationId:z.string().min(1)}).strict().optional(),integrationWindowId:z.string().uuid().optional(),intakeIds:z.array(z.string().uuid()).min(1).optional(),phase:z.enum(['extract','integrate']),recipes:z.array(memoryRecipeBindingSchema).optional(),strategy:memoryRecipeBindingSchema.optional(),integration:memoryIntegrationBindingSchema.optional(),materialPins:z.array(z.object({id:z.string().regex(/^mat_[a-f0-9]{64}$/),revision,required:z.array(z.string()).min(1)}).strict()).optional(),inputs:z.array(memoryInputPinSchema).min(1),related:z.array(z.object({id:z.string().uuid(),version:z.number().int().positive(),fingerprint:revision}).strict()),binding:memoryBindingSchema,generation:z.number().int().nonnegative(),deletionSnapshot:revision,automatic:z.boolean(),profile:z.enum(['personal','coding']),timeZone:z.string()}).strict();
export type ScopedMemoryTask=z.infer<typeof scopedMemoryTaskSchema>;

/** One shared database. Every private key and relationship starts with the
 * host owner; identical material, evidence and memory IDs remain independent. */
export function installScopedMemory(db:DatabaseSync){
 db.exec(`CREATE TABLE IF NOT EXISTS mm_meta(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,cursor_key TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS mm_state(user_id TEXT PRIMARY KEY,deleted INTEGER NOT NULL DEFAULT 0,generation INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,desired INTEGER NOT NULL DEFAULT 1,settings TEXT NOT NULL,binding TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS mm_evidence(user_id TEXT NOT NULL,id TEXT NOT NULL,material_id TEXT NOT NULL,material_revision TEXT NOT NULL,block_id TEXT NOT NULL,hash TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,id),UNIQUE(user_id,material_id,material_revision,block_id),FOREIGN KEY(user_id,material_id,material_revision) REFERENCES pd_material_versions(user_id,material_id,revision) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS mm_images(user_id TEXT NOT NULL,id TEXT NOT NULL,original_id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(user_id,id),FOREIGN KEY(user_id,id) REFERENCES mm_evidence(user_id,id) ON DELETE CASCADE,FOREIGN KEY(user_id,original_id) REFERENCES ig_originals(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS mm_records(user_id TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,fingerprint TEXT NOT NULL,body_digest TEXT NOT NULL,binding TEXT NOT NULL,json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS mm_versions(user_id TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,fingerprint TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,id,version),FOREIGN KEY(user_id,id) REFERENCES mm_records(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS mm_version_bindings(user_id TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,binding TEXT NOT NULL,body_digest TEXT NOT NULL,PRIMARY KEY(user_id,id,version),FOREIGN KEY(user_id,id,version) REFERENCES mm_versions(user_id,id,version) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS mm_dependencies(user_id TEXT NOT NULL,memory_id TEXT NOT NULL,evidence_id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(user_id,memory_id,evidence_id),FOREIGN KEY(user_id,memory_id) REFERENCES mm_records(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS mm_intakes(user_id TEXT NOT NULL,id TEXT NOT NULL,material_id TEXT NOT NULL,revision TEXT NOT NULL,json TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,task_id TEXT,job_id TEXT,created_at TEXT NOT NULL,state TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS mm_integration_windows(user_id TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,task_id TEXT,job_id TEXT,state TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS mm_integrated_versions(user_id TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,fingerprint TEXT NOT NULL,window_id TEXT NOT NULL,PRIMARY KEY(user_id,id,version,fingerprint));
 CREATE TABLE IF NOT EXISTS mm_jobs(user_id TEXT NOT NULL,id TEXT NOT NULL,input TEXT NOT NULL,draft TEXT,review TEXT,prepared TEXT,state TEXT NOT NULL DEFAULT 'admitting',tasks TEXT NOT NULL DEFAULT '{}',PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS mm_job_batches(user_id TEXT NOT NULL,job_id TEXT NOT NULL,id TEXT NOT NULL,input TEXT NOT NULL,draft TEXT,review TEXT,prepared TEXT,state TEXT NOT NULL DEFAULT 'admitting',tasks TEXT NOT NULL DEFAULT '{}',PRIMARY KEY(user_id,job_id,id),FOREIGN KEY(user_id,job_id) REFERENCES mm_jobs(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS mm_binding_locks(user_id TEXT PRIMARY KEY,operation_id TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS mm_binding_preparations(user_id TEXT NOT NULL,id TEXT NOT NULL,source TEXT NOT NULL,target TEXT NOT NULL,catalog_hash TEXT,json TEXT NOT NULL,state TEXT NOT NULL,task_id TEXT,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS mm_provider_descriptors(user_id TEXT NOT NULL,namespace_hash TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,namespace_hash));
 CREATE TABLE IF NOT EXISTS mm_native_cleanup(user_id TEXT NOT NULL,id TEXT NOT NULL,binding TEXT NOT NULL,phase TEXT NOT NULL,state TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS mm_provider_config(user_id TEXT NOT NULL,namespace_hash TEXT NOT NULL,snapshot_id TEXT NOT NULL,operation_id TEXT NOT NULL,configuration_hash TEXT NOT NULL,PRIMARY KEY(user_id,namespace_hash));
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
