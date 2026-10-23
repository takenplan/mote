import type {DatabaseSync,StatementSync} from 'node:sqlite';
import {randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import {catalogParent} from '../source-catalog-path.js';
import {installEvidenceProjection} from './evidence-projection.js';

export const ASK_DOMAIN='ask';
export class AskError extends Error{constructor(readonly code:string,readonly statusCode=400){super(code);}}
export const askHash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Fixed host schema; ordinary retrieval reads/writes use PrivateSql. */
export function installAskRetrieval(db:DatabaseSync):string{
 db.exec(`CREATE TABLE IF NOT EXISTS ma_embeddings(user_id TEXT NOT NULL,evidence_id TEXT NOT NULL,fingerprint TEXT NOT NULL,receipt TEXT NOT NULL,anchor_hash TEXT NOT NULL,model_key TEXT NOT NULL,embedding TEXT NOT NULL,PRIMARY KEY(user_id,evidence_id,model_key));
  CREATE TABLE IF NOT EXISTS ma_embedding_events(user_id TEXT NOT NULL,id TEXT NOT NULL,input TEXT NOT NULL,PRIMARY KEY(user_id,id));
  CREATE TRIGGER IF NOT EXISTS ma_embedding_capture_removed AFTER DELETE ON pd_captures BEGIN DELETE FROM ma_embeddings WHERE user_id=old.user_id AND evidence_id=old.id; END;
  CREATE TRIGGER IF NOT EXISTS ma_embedding_material_removed AFTER DELETE ON mm_evidence BEGIN DELETE FROM ma_embeddings WHERE user_id=old.user_id AND evidence_id=old.id; END;`);
 return String(db.prepare('PRAGMA database_list').get()!.file);
}
const time=z.string().datetime({offset:true});
export const askInputSchema=z.object({modelReference:z.object({kind:z.enum(['shared','personal']),id:z.string().min(1).max(256)}).strict().optional(),modelOverride:z.string().trim().min(1).max(512).refine(value=>!/[\u0000-\u001f\u007f]/.test(value)).optional(),question:z.string().trim().min(1).max(8000),attachmentIds:z.array(z.string().uuid()).max(8).refine(ids=>new Set(ids).size===ids.length).optional(),conversationId:z.string().uuid().optional(),turnId:z.string().uuid().optional(),after:time.optional(),before:time.optional(),deviceId:z.string().min(1).max(128).optional(),timeZone:z.string().max(100).default('UTC'),language:z.enum(['zh-CN','en']).default('zh-CN')}).strict().refine(v=>!v.after||!v.before||Date.parse(v.after)<Date.parse(v.before),'Invalid time range');
export const insightInputSchema=askInputSchema.innerType().extend({question:z.string().trim().min(1).max(8000).optional(),prompt:z.string().trim().max(8000).optional()}).strict().refine(v=>!v.question||!v.prompt,'Choose one prompt').transform(({question,prompt,...value})=>askInputSchema.parse({...value,question:question||prompt||(value.language==='en'?'Review this period of personal context. Choose findings supported by evidence, distinguish facts, inferences and gaps, retain source citations and produce a complete personal-insight report and static HTML.':'请回顾这段时间的个人上下文，选择有证据支撑的发现。区分事实、推断与信息缺口，保留来源引用，用 personal-insight Skill 生成完整文字报告和静态 HTML 展示。')}));
export type AskInput=z.infer<typeof askInputSchema>;
export const askTaskSchema=z.object({runId:z.string().uuid(),generation:z.number().int().nonnegative(),fragment:z.number().int().nonnegative().optional(),unitId:z.string().min(1).max(128).optional(),mode:z.enum(['chat','insight','compact'])}).strict();
export type AskTask=z.infer<typeof askTaskSchema>;
export type AskSnapshot={at:string;materials:{id:string;revision:string}[];captures:{id:string;receipt:string}[];memories:{id:string;version:number;fingerprint:string}[]};
export type AskScope={sourceIds?:readonly string[];snapshot?:AskSnapshot;assertCurrent:()=>void};
export type EvidencePin={id:string;hash:string;receipt?:string;kind?:'measurement'|'history'|'attachment';headId?:string;source?:{id:string;incarnation:string}};
export type MaterialPin={id:string;revision:string;sources?:{id:string;incarnation:string}[];sourceContext?:{sourceId:string;version:number;fingerprint:string;kind?:'metadata'}};
export type AskRow={id:string;input:string;fingerprint:string;mode:'chat'|'insight'|'compact';status:string;generation:number;fragment:number;task_id:string|null;model:string;scope:string;context:string;conversation_revision:number;conversation_incarnation:string;pins:string;materials:string;memory_pins:string;events:string;workspace:string|null;request_bound:number;created_at:string;updated_at:string;result:string|null};
/** Persisted SQL, rather than connection-local callbacks, also protects offline
 * writers. Dependencies are owner-bound and include inherited dialogue roots. */
function installConversationHistory(db:DatabaseSync){
 type RootKind='capture'|'material'|'source';
 db.exec(`CREATE TABLE IF NOT EXISTS ma_history_materials(user_id TEXT NOT NULL,id TEXT NOT NULL,incarnation TEXT NOT NULL,PRIMARY KEY(user_id,id));
 INSERT OR IGNORE INTO ma_history_materials SELECT user_id,id,lower(hex(randomblob(16))) FROM pd_materials;
 CREATE TRIGGER IF NOT EXISTS ma_history_material_created AFTER INSERT ON pd_materials BEGIN INSERT INTO ma_history_materials VALUES(new.user_id,new.id,lower(hex(randomblob(16)))) ON CONFLICT(user_id,id) DO UPDATE SET incarnation=excluded.incarnation; END;
 CREATE TRIGGER IF NOT EXISTS ma_history_material_removed AFTER DELETE ON pd_materials BEGIN DELETE FROM ma_history_materials WHERE user_id=old.user_id AND id=old.id; END;
 CREATE TABLE IF NOT EXISTS ma_history_turns(user_id TEXT NOT NULL,turn_id TEXT NOT NULL,proof TEXT NOT NULL,stale INTEGER NOT NULL DEFAULT 0,deleted INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,turn_id),FOREIGN KEY(user_id,turn_id) REFERENCES ma_turns(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS ma_history_dependencies(user_id TEXT NOT NULL,turn_id TEXT NOT NULL,kind TEXT NOT NULL,root_id TEXT NOT NULL,PRIMARY KEY(user_id,turn_id,kind,root_id),FOREIGN KEY(user_id,turn_id) REFERENCES ma_history_turns(user_id,turn_id) ON DELETE CASCADE);
 CREATE INDEX IF NOT EXISTS ma_history_root ON ma_history_dependencies(user_id,kind,root_id,turn_id);
 CREATE TABLE IF NOT EXISTS ma_history_runs(user_id TEXT NOT NULL,run_id TEXT NOT NULL,proof TEXT NOT NULL,PRIMARY KEY(user_id,run_id),FOREIGN KEY(user_id,run_id) REFERENCES ma_runs(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS ma_history_run_dependencies(user_id TEXT NOT NULL,run_id TEXT NOT NULL,kind TEXT NOT NULL,root_id TEXT NOT NULL,PRIMARY KEY(user_id,run_id,kind,root_id),FOREIGN KEY(user_id,run_id) REFERENCES ma_history_runs(user_id,run_id) ON DELETE CASCADE);
 CREATE INDEX IF NOT EXISTS ma_history_run_root ON ma_history_run_dependencies(user_id,kind,root_id,run_id);`);
 const matching=(owner:string,kind:RootKind,id:string)=>`SELECT t.id FROM ma_turns t WHERE t.user_id=${owner} AND (EXISTS(SELECT 1 FROM ma_history_dependencies d WHERE d.user_id=t.user_id AND d.turn_id=t.id AND d.kind='${kind}' AND d.root_id=${id}) OR NOT EXISTS(SELECT 1 FROM ma_history_turns h WHERE h.user_id=t.user_id AND h.turn_id=t.id))`;
 const matchingRuns=(owner:string,kind:RootKind,id:string)=>`SELECT r.id FROM ma_runs r WHERE r.user_id=${owner} AND (EXISTS(SELECT 1 FROM ma_history_run_dependencies d WHERE d.user_id=r.user_id AND d.run_id=r.id AND d.kind='${kind}' AND d.root_id=${id}) OR NOT EXISTS(SELECT 1 FROM ma_history_runs h WHERE h.user_id=r.user_id AND h.run_id=r.id))`;
 const change=(owner:string,turns:string,deleted:boolean,runs:string)=>{
  const condition=`user_id=${owner} AND id IN (${turns})`;
  return `UPDATE ma_conversations SET summary=NULL,revision=revision+1 WHERE user_id=${owner} AND id IN(SELECT conversation_id FROM ma_turns WHERE ${condition});
   ${deleted?`UPDATE ma_runs SET result=NULL,context='{}',workspace=NULL,events='[]',generation=generation+1,status=CASE WHEN status='running' THEN 'failed' ELSE status END WHERE user_id=${owner} AND id IN (${runs});
    UPDATE user_tasks SET checkpoints='{}',progress='null' WHERE user_id=${owner} AND task_id IN(SELECT task_id FROM ma_fragments WHERE user_id=${owner} AND run_id IN (${runs}) UNION SELECT task_id FROM ma_runs WHERE user_id=${owner} AND id IN (${runs}));
    DELETE FROM ma_artifacts WHERE user_id=${owner} AND run_id IN (${runs});
    DELETE FROM ma_traces WHERE user_id=${owner} AND run_id IN (${runs});
    UPDATE ma_units SET input='{}' WHERE user_id=${owner} AND run_id IN (${runs});
    UPDATE ma_turns SET result=json_object('answer','','citations',json('[]'),'trace',json('[]'),'runId',coalesce(json_extract(result,'$.runId'),'')) WHERE ${condition};`:''}
   UPDATE ma_history_turns SET ${deleted?'deleted=1,stale=0':'stale=1'} WHERE user_id=${owner} AND turn_id IN (${turns});
   ${deleted?`INSERT OR IGNORE INTO ma_history_turns SELECT user_id,id,'{"version":1,"roots":[],"pins":[],"materials":[]}',0,1 FROM ma_turns WHERE ${condition};`:''}`;
 };
 for(const [name,table,event,owner,kind,id,when,deleted] of [
  ['capture_deleted','pd_captures','BEFORE DELETE','old.user_id','capture','old.id','',true],
  ['material_deleted','pd_materials','BEFORE DELETE','old.user_id','material','old.id','',true],
  ['source_deleted','pd_sources','BEFORE DELETE','old.user_id','source','old.id','',true],
  ['capture_changed','pd_captures','AFTER UPDATE OF json,fingerprint','new.user_id','capture','new.id','WHEN new.json!=old.json OR new.fingerprint!=old.fingerprint',false],
  ['material_changed','pd_materials','AFTER UPDATE OF revision,min_visible_sequence','new.user_id','material','new.id','WHEN new.revision!=old.revision OR new.min_visible_sequence!=old.min_visible_sequence',false],
  ['source_changed','pd_sources','AFTER UPDATE OF json','new.user_id','source','new.id',"WHEN json_extract(new.json,'$.enabled') IS NOT json_extract(old.json,'$.enabled') OR json_extract(new.json,'$.retention') IS NOT json_extract(old.json,'$.retention') OR json_extract(new.json,'$.ownerRelation') IS NOT json_extract(old.json,'$.ownerRelation') OR json_extract(new.json,'$.ownerRelationVersion') IS NOT json_extract(old.json,'$.ownerRelationVersion') OR json_extract(new.json,'$.sourceContext') IS NOT json_extract(old.json,'$.sourceContext') OR json_extract(new.json,'$.name') IS NOT json_extract(old.json,'$.name') OR json_extract(new.json,'$.deviceId') IS NOT json_extract(old.json,'$.deviceId') OR json_extract(new.json,'$.kind') IS NOT json_extract(old.json,'$.kind') OR json_extract(new.json,'$.platform') IS NOT json_extract(old.json,'$.platform')",false],
 ] as const){db.exec(`DROP TRIGGER IF EXISTS ma_history_${name};CREATE TRIGGER ma_history_${name} ${event} ON ${table} ${when} BEGIN ${change(owner,matching(owner,kind,id),deleted,matchingRuns(owner,kind,id))} END;`);}
 // M07 anchors are disposable interpretation cache. Withdraw prepared context
 // and summaries before their lineage disappears, retaining historical prose.
 db.exec(`DROP TRIGGER IF EXISTS ma_history_cache_removed;CREATE TRIGGER ma_history_cache_removed BEFORE DELETE ON mm_evidence BEGIN ${change('old.user_id',matching('old.user_id','material','old.material_id'),false,matchingRuns('old.user_id','material','old.material_id'))} END;`);
 // Ordinary cache/projection withdrawal may hide a head until rebuilding.
 // Only the explicit owner/privacy retirement event erases historical prose.
 for(const event of ['INSERT','UPDATE OF epoch'] as const){const name=event==='INSERT'?'insert':'update';db.exec(`DROP TRIGGER IF EXISTS ma_history_retire_${name};CREATE TRIGGER ma_history_retire_${name} AFTER ${event} ON pd_material_retirements BEGIN ${change('new.user_id',matching('new.user_id','material','new.material_id'),true,matchingRuns('new.user_id','material','new.material_id'))} UPDATE ma_history_materials SET incarnation=lower(hex(randomblob(16))) WHERE user_id=new.user_id AND id=new.material_id; END;`);}
 // Tombstones retract all retained versions of that source item, not merely its
 // latest capture. Later recreation must never make erased prose reappear.
 for(const event of ['INSERT','UPDATE OF capture_id'] as const){
  const turns=`SELECT t.id FROM ma_turns t WHERE t.user_id=new.user_id AND (EXISTS(SELECT 1 FROM ma_history_dependencies d JOIN pd_captures c ON c.user_id=d.user_id AND c.id=d.root_id WHERE d.user_id=t.user_id AND d.turn_id=t.id AND d.kind='capture' AND c.source_id=new.source_id AND c.external_id=new.external_id) OR NOT EXISTS(SELECT 1 FROM ma_history_turns h WHERE h.user_id=t.user_id AND h.turn_id=t.id))`;
  const runs=`SELECT r.id FROM ma_runs r WHERE r.user_id=new.user_id AND (EXISTS(SELECT 1 FROM ma_history_run_dependencies d JOIN pd_captures c ON c.user_id=d.user_id AND c.id=d.root_id WHERE d.user_id=r.user_id AND d.run_id=r.id AND d.kind='capture' AND c.source_id=new.source_id AND c.external_id=new.external_id) OR NOT EXISTS(SELECT 1 FROM ma_history_runs h WHERE h.user_id=r.user_id AND h.run_id=r.id))`;
  const name=event==='INSERT'?'insert':'update';db.exec(`DROP TRIGGER IF EXISTS ma_history_tombstone_${name};CREATE TRIGGER ma_history_tombstone_${name} AFTER ${event} ON pd_source_heads WHEN coalesce((SELECT json_extract(json,'$.provenance.deleted') FROM pd_captures WHERE user_id=new.user_id AND id=new.capture_id),0)=1 BEGIN ${change('new.user_id',turns,true,runs)} END;`);
 }
}

export function installAsk(db:DatabaseSync){
 installEvidenceProjection(db);
 db.exec('SAVEPOINT ma_schema_install');try{
 // Backfill is a one-time schema migration. Normal publication triggers keep
 // the journal current; repeating it would turn personal imports into new work.
 const initializeEvents=!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='ma_auto_events'").get();
 db.function('ma_catalog_parent',{deterministic:true},catalogParent);db.exec(`
 CREATE TABLE IF NOT EXISTS ma_meta(singleton INTEGER PRIMARY KEY CHECK(singleton=1),cursor_key TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS ma_sources(user_id TEXT NOT NULL,id TEXT NOT NULL,incarnation TEXT NOT NULL,PRIMARY KEY(user_id,id));
 INSERT OR IGNORE INTO ma_sources SELECT user_id,id,lower(hex(randomblob(16))) FROM pd_sources;
 CREATE TRIGGER IF NOT EXISTS ma_source_created AFTER INSERT ON pd_sources BEGIN INSERT INTO ma_sources VALUES(new.user_id,new.id,lower(hex(randomblob(16)))) ON CONFLICT(user_id,id) DO UPDATE SET incarnation=excluded.incarnation; END;
 CREATE TRIGGER IF NOT EXISTS ma_source_deleted AFTER DELETE ON pd_sources BEGIN DELETE FROM ma_sources WHERE user_id=old.user_id AND id=old.id; END;
 CREATE TABLE IF NOT EXISTS ma_originals(user_id TEXT NOT NULL,id TEXT NOT NULL,incarnation TEXT NOT NULL,PRIMARY KEY(user_id,id));
 INSERT OR IGNORE INTO ma_originals SELECT user_id,id,lower(hex(randomblob(16))) FROM pd_captures;
 CREATE TRIGGER IF NOT EXISTS ma_original_created AFTER INSERT ON pd_captures BEGIN INSERT INTO ma_originals VALUES(new.user_id,new.id,lower(hex(randomblob(16)))) ON CONFLICT(user_id,id) DO UPDATE SET incarnation=excluded.incarnation; END;
 CREATE TRIGGER IF NOT EXISTS ma_original_deleted AFTER DELETE ON pd_captures BEGIN DELETE FROM ma_originals WHERE user_id=old.user_id AND id=old.id; END;
 CREATE TABLE IF NOT EXISTS ma_read_cursors(user_id TEXT NOT NULL,id TEXT NOT NULL,position TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS ma_state(user_id TEXT PRIMARY KEY,deleted INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS ma_conversations(user_id TEXT NOT NULL,id TEXT NOT NULL,incarnation TEXT NOT NULL,scope TEXT NOT NULL,title TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,summary TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS ma_turns(user_id TEXT NOT NULL,conversation_id TEXT NOT NULL,id TEXT NOT NULL,position INTEGER NOT NULL,input TEXT NOT NULL,result TEXT NOT NULL,pins TEXT NOT NULL,materials TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,id),UNIQUE(user_id,conversation_id,position),FOREIGN KEY(user_id,conversation_id) REFERENCES ma_conversations(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS ma_runs(user_id TEXT NOT NULL,id TEXT NOT NULL,input TEXT NOT NULL,fingerprint TEXT NOT NULL,mode TEXT NOT NULL,status TEXT NOT NULL,generation INTEGER NOT NULL DEFAULT 0,fragment INTEGER NOT NULL DEFAULT 0,task_id TEXT,model TEXT NOT NULL,scope TEXT NOT NULL,context TEXT NOT NULL,conversation_revision INTEGER NOT NULL,conversation_incarnation TEXT NOT NULL,pins TEXT NOT NULL DEFAULT '[]',materials TEXT NOT NULL DEFAULT '[]',memory_pins TEXT NOT NULL DEFAULT '[]',events TEXT NOT NULL DEFAULT '[]',workspace TEXT,request_bound INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,result TEXT,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS ma_fragments(user_id TEXT NOT NULL,run_id TEXT NOT NULL,id TEXT NOT NULL,task_id TEXT NOT NULL,PRIMARY KEY(user_id,run_id,id),FOREIGN KEY(user_id,run_id) REFERENCES ma_runs(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS ma_units(user_id TEXT NOT NULL,run_id TEXT NOT NULL,id TEXT NOT NULL,fingerprint TEXT NOT NULL,input TEXT NOT NULL,task_id TEXT,PRIMARY KEY(user_id,run_id,id),FOREIGN KEY(user_id,run_id) REFERENCES ma_runs(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS ma_artifacts(user_id TEXT NOT NULL,id TEXT NOT NULL,run_id TEXT NOT NULL,fragment_id TEXT NOT NULL,json TEXT NOT NULL,pins TEXT NOT NULL,materials TEXT NOT NULL,PRIMARY KEY(user_id,id),UNIQUE(user_id,run_id,fragment_id),FOREIGN KEY(user_id,run_id) REFERENCES ma_runs(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS ma_traces(user_id TEXT NOT NULL,run_id TEXT NOT NULL,sequence INTEGER NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,run_id,sequence),FOREIGN KEY(user_id,run_id) REFERENCES ma_runs(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS ma_insight_snapshots(user_id TEXT NOT NULL,run_id TEXT NOT NULL,series_id TEXT NOT NULL,version INTEGER NOT NULL,manifest TEXT NOT NULL,json TEXT NOT NULL,memory_coverage TEXT NOT NULL,PRIMARY KEY(user_id,run_id),FOREIGN KEY(user_id,run_id) REFERENCES ma_runs(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS ma_auto_restore(user_id TEXT NOT NULL,operation_id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(user_id,operation_id));
 CREATE TABLE IF NOT EXISTS ma_auto_state(user_id TEXT PRIMARY KEY,deleted INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS ma_automations(user_id TEXT NOT NULL,id TEXT NOT NULL,generation TEXT NOT NULL,state TEXT NOT NULL,input TEXT NOT NULL,settings TEXT NOT NULL,sources TEXT NOT NULL,task_id TEXT,cursor INTEGER NOT NULL,last_success INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS ma_auto_events(user_id TEXT NOT NULL,seq INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,entity TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS ma_auto_event_owner ON ma_auto_events(user_id,kind,seq);
 CREATE TRIGGER IF NOT EXISTS ma_auto_material_insert AFTER INSERT ON pd_materials BEGIN INSERT INTO ma_auto_events(user_id,kind,entity) VALUES(new.user_id,'insights',new.id); END;
 CREATE TRIGGER IF NOT EXISTS ma_auto_material_update AFTER UPDATE ON pd_materials WHEN new.revision!=old.revision OR new.min_visible_sequence!=old.min_visible_sequence BEGIN INSERT INTO ma_auto_events(user_id,kind,entity) VALUES(new.user_id,'insights',new.id); END;
 DROP TRIGGER IF EXISTS ma_auto_turn;
 CREATE TRIGGER ma_auto_turn AFTER INSERT ON ma_turns WHEN coalesce(json_extract(new.result,'$.status'),'completed')!='failed' BEGIN INSERT INTO ma_auto_events(user_id,kind,entity) VALUES(new.user_id,'working',new.conversation_id); END;
 CREATE TABLE IF NOT EXISTS ma_auto_windows(user_id TEXT NOT NULL,id TEXT NOT NULL,policy_id TEXT NOT NULL,generation TEXT NOT NULL,state TEXT NOT NULL,through INTEGER NOT NULL,plan TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS ma_auto_runs(user_id TEXT NOT NULL,run_id TEXT NOT NULL,window_id TEXT NOT NULL,policy_id TEXT NOT NULL,generation TEXT NOT NULL,PRIMARY KEY(user_id,run_id));
 CREATE TABLE IF NOT EXISTS ma_restore(user_id TEXT NOT NULL,operation_id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(user_id,operation_id));
 `);installConversationHistory(db);if(initializeEvents)db.exec("INSERT INTO ma_auto_events(user_id,kind,entity) SELECT m.user_id,'insights',m.id FROM pd_materials m");db.prepare('INSERT OR IGNORE INTO ma_meta VALUES(1,?)').run(randomBytes(32).toString('hex'));const cursorKey=String(db.prepare('SELECT cursor_key FROM ma_meta WHERE singleton=1').get()!.cursor_key);db.exec('RELEASE ma_schema_install');return cursorKey;}catch(error){db.exec('ROLLBACK TO ma_schema_install;RELEASE ma_schema_install');throw error;}}

// Private to the host admission predicates below. A reused compiled query
// still binds its complete owner/run identity and reads current SQLite rows.
const validationStatements=new WeakMap<DatabaseSync,Map<string,StatementSync>>();
function askValidationStatement(db:DatabaseSync,sql:string){
 let cache=validationStatements.get(db);if(!cache){cache=new Map();validationStatements.set(db,cache);}
 const prior=cache.get(sql);
 if(prior){try{void prior.sourceSQL;return prior;}catch(error){
  if((error as NodeJS.ErrnoException).code!=='ERR_INVALID_STATE'||!db.isOpen)throw error;
  cache.delete(sql);
 }}
 const statement=db.prepare(sql);cache.set(sql,statement);return statement;
}

/** Host-only M05 validation, before a task context exists. Owner comes only from the engine's durable ownership record. */
export function persistedAskRun(db:DatabaseSync,userId:string,id:string){return askValidationStatement(db,'SELECT * FROM ma_runs WHERE user_id=? AND id=?').get(userId,id) as AskRow|undefined;}
export function askUserDeleted(db:DatabaseSync,userId:string){return Boolean(askValidationStatement(db,'SELECT 1 FROM ma_state WHERE user_id=? AND deleted=1').get(userId));}

export function persistedAutomationCurrent(db:DatabaseSync,userId:string,runId:string){const link=askValidationStatement(db,'SELECT policy_id,generation FROM ma_auto_runs WHERE user_id=? AND run_id=?').get(userId,runId);return !link||Boolean(askValidationStatement(db,"SELECT 1 FROM ma_automations a WHERE user_id=? AND id=? AND generation=? AND state='active' AND NOT EXISTS(SELECT 1 FROM ma_auto_state s WHERE s.user_id=a.user_id AND s.deleted=1)").get(userId,link.policy_id,link.generation));}


/** Read-only M08 admission predicate. The engine supplies the durable owner and
 * validates the root task before consulting this; no context or grant is minted.
 * Admit real coordination when a unit needs scheduling or a fragment can advance.
 */
export function persistedAskChildrenPending(db:DatabaseSync,userId:string,runId:string){
 const row=persistedAskRun(db,userId,runId);if(!row||askUserDeleted(db,userId))return false;
 // Waiting must not conceal an error that normal coordination would detect.
 // A stale conversation enters the existing execute/current failure path now,
 // even when a physical child is still held and has not produced another event.
 let conversationId:unknown;try{conversationId=JSON.parse(row.input).conversationId;}catch{return false;}
 if(typeof conversationId!=='string')return false;
 const conversation=db.prepare('SELECT scope,incarnation,revision FROM ma_conversations WHERE user_id=? AND id=?').get(userId,conversationId);
 if(!conversation||conversation.scope!==row.scope||conversation.incarnation!==row.conversation_incarnation||conversation.revision!==row.conversation_revision)return false;
 const units=db.prepare('SELECT u.id,u.task_id,e.state,f.id fragment FROM ma_units u LEFT JOIN execution_steps e ON e.user_id=u.user_id AND e.id=u.task_id LEFT JOIN ma_fragments f ON f.user_id=u.user_id AND f.run_id=u.run_id AND f.task_id=u.task_id WHERE u.user_id=? AND u.run_id=?').all(userId,runId);
 if(units.some(unit=>!unit.task_id||unit.state!=='succeeded'&&unit.fragment!=='unit:'+unit.id+':'+row.generation))return false;
 const fragment='main:'+row.generation+':'+row.fragment,step=db.prepare('SELECT e.state FROM ma_fragments f JOIN execution_steps e ON e.user_id=f.user_id AND e.id=f.task_id WHERE f.user_id=? AND f.run_id=? AND f.id=?').get(userId,runId,fragment);
 if(!step)return false;
 if(step.state==='waiting'||step.state==='running')return true;
 if(step.state!=='succeeded')return false;
 const artifact=db.prepare('SELECT json FROM ma_artifacts WHERE user_id=? AND run_id=? AND fragment_id=?').get(userId,runId,fragment);if(!artifact)return false;
 let result:{kind?:string;wait?:{unitIds:string[];mode:'any'|'all'}};try{result=JSON.parse(String(artifact.json));}catch{return false;}
 if(!result||result.kind!=='yield'||result.wait&&(!Array.isArray(result.wait.unitIds)||result.wait.unitIds.some(id=>typeof id!=='string')||!['any','all'].includes(result.wait.mode)))return false;
 const states=units.filter(unit=>!result.wait||result.wait.unitIds.includes(String(unit.id))).map(unit=>Boolean(unit.task_id)&&!['waiting','running'].includes(String(unit.state)));
 return states.length>0&&!(result.wait?.mode==='any'?states.some(Boolean):states.every(Boolean));
}
