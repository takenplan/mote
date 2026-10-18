import type {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {calendarDraftSchema,calendarChoiceSchema,actionZone,type ActionProposal} from '@mote/shared';
import type {EvidencePin,MaterialPin} from './ask-schema.js';
export const ACTIONS_DOMAIN='actions';
export const actionSettingsSchema=z.object({enabled:z.boolean(),timeZone:actionZone,reviewDeviceIds:z.array(z.string().min(1).max(200)).max(100)}).strict();
export const confirmationSchema=z.object({version:z.number().int().positive(),event:calendarDraftSchema,target:z.object({deviceId:z.string().min(1).max(200),calendarId:z.string().min(1).max(1000)}).strict().optional()}).strict();
export const targetSchema=z.object({deviceId:z.string().min(1).max(200),deviceName:z.string().min(1).max(200),calendars:z.array(calendarChoiceSchema.extend({accountId:z.string().min(1).max(1000).optional()})).max(200)}).strict();
export type ActionProof={pins:EvidencePin[];materials:MaterialPin[];sources:{id:string;epoch:string}[]};
export type ActionRow={id:string;json:string;proof:string;scope:string;created_at:string};
export type ActionRecord={action:ActionProposal;proof:ActionProof;sourceIds?:readonly string[]};
const actionTarget=z.object({deviceId:z.string().min(1).max(200),calendarId:z.string().min(1).max(1000)}).strict();
const actionStatus=z.enum(['proposed','dismissed','approved','executing','succeeded','uncertain','stale']);
export const archivedActionSchema=z.object({id:z.string().uuid(),kind:z.enum(['calendar.create','calendar.update','calendar.cancel','calendar.complete']),version:z.number().int().positive(),status:actionStatus,event:calendarDraftSchema,uncertainty:z.string().max(2000),evidence:z.array(z.object({id:z.string().uuid(),quote:z.string().min(1).max(2000),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),source:z.string(),capturedAt:z.string().datetime({offset:true})}).strict()).max(40),createdAt:z.string().datetime({offset:true}),updatedAt:z.string().datetime({offset:true}),related:z.object({operationId:z.string().uuid().optional(),actionId:z.string().uuid(),version:z.number().int().positive(),status:actionStatus,event:calendarDraftSchema,target:actionTarget.optional(),externalId:z.string().min(1).max(2000).optional()}).strict().optional(),resolution:z.enum(['cancelled','completed']).optional(),operationId:z.string().uuid().optional(),nativeOperationId:z.string().uuid().optional(),target:actionTarget.optional(),externalId:z.string().min(1).max(2000).optional(),error:z.string().max(2000).optional()}).strict();
export function installActions(db:DatabaseSync){db.exec(`
 CREATE TABLE IF NOT EXISTS ac_meta(id INTEGER PRIMARY KEY CHECK(id=1),cursor_key TEXT NOT NULL,installation_epoch TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS ac_state(user_id TEXT PRIMARY KEY,deleted INTEGER NOT NULL DEFAULT 0,generation INTEGER NOT NULL DEFAULT 0,settings TEXT NOT NULL DEFAULT '{"enabled":false,"timeZone":"Asia/Shanghai"}',authorization_revision INTEGER NOT NULL DEFAULT 0,review_devices TEXT NOT NULL DEFAULT '[]',policy_id TEXT,policy_task TEXT);
 CREATE TABLE IF NOT EXISTS ac_sources(user_id TEXT NOT NULL,id TEXT NOT NULL,epoch TEXT NOT NULL,PRIMARY KEY(user_id,id));
 INSERT OR IGNORE INTO ac_sources SELECT s.user_id,s.id,lower(hex(randomblob(16))) FROM pd_sources s WHERE NOT EXISTS(SELECT 1 FROM ac_state a WHERE a.user_id=s.user_id AND a.deleted=1);
 DROP TRIGGER IF EXISTS ac_source_insert;
 CREATE TRIGGER ac_source_insert AFTER INSERT ON pd_sources WHEN NOT EXISTS(SELECT 1 FROM ac_state a WHERE a.user_id=new.user_id AND a.deleted=1) BEGIN INSERT INTO ac_sources VALUES(new.user_id,new.id,lower(hex(randomblob(16)))) ON CONFLICT(user_id,id) DO UPDATE SET epoch=excluded.epoch; END;
 DROP TRIGGER IF EXISTS ac_source_update;
 -- A display rename or timestamp-only save preserves evidence and authorization.
 -- Every other source change still retires the old Actions proof and approval.
 CREATE TRIGGER ac_source_update AFTER UPDATE ON pd_sources WHEN json_remove(new.json,'$.name','$.updatedAt')!=json_remove(old.json,'$.name','$.updatedAt') AND NOT EXISTS(SELECT 1 FROM ac_state a WHERE a.user_id=new.user_id AND a.deleted=1) BEGIN UPDATE ac_sources SET epoch=lower(hex(randomblob(16))) WHERE user_id=new.user_id AND id=new.id; END;
 CREATE TRIGGER IF NOT EXISTS ac_source_delete AFTER DELETE ON pd_sources BEGIN DELETE FROM ac_sources WHERE user_id=old.user_id AND id=old.id; END;
 CREATE TABLE IF NOT EXISTS ac_proposals(user_id TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,proof TEXT NOT NULL,scope TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS ac_dependencies(user_id TEXT NOT NULL,action_id TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,PRIMARY KEY(user_id,action_id,kind,id),FOREIGN KEY(user_id,action_id) REFERENCES ac_proposals(user_id,id) ON DELETE CASCADE);
 CREATE INDEX IF NOT EXISTS ac_proposal_page ON ac_proposals(user_id,created_at DESC,id DESC);
 CREATE TABLE IF NOT EXISTS ac_targets(user_id TEXT NOT NULL,device_id TEXT NOT NULL,epoch TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,device_id));
 CREATE TABLE IF NOT EXISTS ac_discovery_state(user_id TEXT PRIMARY KEY,captures INTEGER NOT NULL DEFAULT 0,materials INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS ac_jobs(user_id TEXT NOT NULL,id TEXT NOT NULL,input TEXT NOT NULL,proof TEXT NOT NULL,task_id TEXT,state TEXT NOT NULL DEFAULT 'pending',PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS ac_operations(user_id TEXT NOT NULL,id TEXT NOT NULL,action_id TEXT NOT NULL,approval_hash TEXT NOT NULL,target_epoch TEXT,authorization_revision INTEGER NOT NULL,account_epoch INTEGER NOT NULL,native_external_id TEXT,task_id TEXT,issuance_id TEXT,claimed INTEGER NOT NULL DEFAULT 0,ack TEXT,revoked INTEGER NOT NULL DEFAULT 0,published INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,id),FOREIGN KEY(user_id,action_id) REFERENCES ac_proposals(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS ac_restore(user_id TEXT NOT NULL,id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(user_id,id));
 `);
 // Preserve the exact known native event independently of private evidence scrubbing.
 if(!db.prepare('PRAGMA table_info(ac_operations)').all().some(row=>row.name==='native_external_id')){
  db.exec("ALTER TABLE ac_operations ADD COLUMN native_external_id TEXT; UPDATE ac_operations SET native_external_id=(SELECT json_extract(p.json,'$.related.externalId') FROM ac_proposals p WHERE p.user_id=ac_operations.user_id AND p.id=ac_operations.action_id);");
 }
 // Canonical Material IDs are not original IDs. Store their complete raw/source
 // closure when saving, then erase quotes synchronously even while disabled.
 for(const [table,kind] of [['pd_captures','capture'],['pd_materials','material'],['pd_sources','source']] as const){const selected=`SELECT action_id FROM ac_dependencies WHERE user_id=old.user_id AND kind='${kind}' AND id=old.id`;db.exec(`CREATE TRIGGER IF NOT EXISTS ac_${kind}_deleted BEFORE DELETE ON ${table} BEGIN
  UPDATE ac_operations SET revoked=1 WHERE user_id=old.user_id AND action_id IN(${selected});
  UPDATE ac_proposals SET json=json_remove(json_set(json,'$.evidence',json('[]'),'$.event',json('{"title":"来源已删除的日程建议","start":null,"end":null,"timeZone":null,"allDay":false,"location":"","description":""}'),'$.uncertainty','','$.status','stale','$.version',json_extract(json,'$.version')+1),'$.related'),proof='{"pins":[],"materials":[],"sources":[]}' WHERE user_id=old.user_id AND id IN(${selected});
  DELETE FROM oq_questions WHERE user_id=old.user_id AND json_extract(json,'$.question.provider.id')='actions.calendar' AND json_extract(json,'$.question.workId') IN(${selected});
 END;`);}
 db.prepare('INSERT OR IGNORE INTO ac_meta VALUES(1,?,?)').run(randomBytes(32).toString('hex'),randomUUID());return db.prepare('SELECT cursor_key,installation_epoch FROM ac_meta WHERE id=1').get() as {cursor_key:string;installation_epoch:string};}

export const actionsDeleted=(db:DatabaseSync,userId:string)=>Boolean(db.prepare('SELECT deleted FROM ac_state WHERE user_id=?').get(userId)?.deleted);
export function actionPolicyCurrent(db:DatabaseSync,userId:string,input:{id:unknown;generation:unknown},taskId:string){const state=db.prepare('SELECT * FROM ac_state WHERE user_id=?').get(userId);return Boolean(state&&!state.deleted&&JSON.parse(String(state.settings)).enabled===true&&state.policy_id===input.id&&state.generation===input.generation&&state.policy_task===taskId);}

/** Schema installation is the only unscoped SQL exception for Actions. */
export function installActionSemanticSchema(db:DatabaseSync){
  db.exec(`CREATE INDEX IF NOT EXISTS ac_capture_segment_group ON pd_captures(user_id,json_extract(json,'$.deviceId'),json_extract(json,'$.source'),json_extract(json,'$.appId'),json_extract(json,'$.windowTitle'),json_extract(json,'$.provenance.sourceId'),floor(unixepoch(json_extract(json,'$.capturedAt'),'subsec')/300),context_at,id);
   CREATE TABLE IF NOT EXISTS ac_semantic_products(user_id TEXT NOT NULL,id TEXT NOT NULL,revision TEXT NOT NULL,input TEXT NOT NULL,proof TEXT NOT NULL,task_id TEXT,json TEXT,consumed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,id,revision));
   CREATE TABLE IF NOT EXISTS ac_semantic_dependencies(user_id TEXT NOT NULL,id TEXT NOT NULL,revision TEXT NOT NULL,kind TEXT NOT NULL,root_id TEXT NOT NULL,PRIMARY KEY(user_id,id,revision,kind,root_id),FOREIGN KEY(user_id,id,revision) REFERENCES ac_semantic_products(user_id,id,revision) ON DELETE CASCADE);`);
  for(const [table,kind] of [['pd_captures','capture'],['pd_sources','source']] as const)db.exec(`CREATE TRIGGER IF NOT EXISTS ac_semantic_${kind}_deleted BEFORE DELETE ON ${table} BEGIN DELETE FROM ac_semantic_products WHERE user_id=old.user_id AND (id,revision) IN(SELECT id,revision FROM ac_semantic_dependencies WHERE user_id=old.user_id AND kind='${kind}' AND root_id=old.id); END;`);
}
