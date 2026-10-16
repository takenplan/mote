import type {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import {catalogParent} from '../source-catalog-path.js';

export const ASK_DOMAIN='ask';
export class AskError extends Error{constructor(readonly code:string,readonly statusCode=400){super(code);}}
export const askHash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const time=z.string().datetime({offset:true});
export const askInputSchema=z.object({question:z.string().trim().min(1).max(8000),attachmentIds:z.array(z.string().uuid()).max(8).refine(ids=>new Set(ids).size===ids.length).optional(),conversationId:z.string().uuid().optional(),turnId:z.string().uuid().optional(),after:time.optional(),before:time.optional(),deviceId:z.string().min(1).max(128).optional(),timeZone:z.string().max(100).default('UTC'),language:z.enum(['zh-CN','en']).default('zh-CN')}).strict().refine(v=>!v.after||!v.before||Date.parse(v.after)<Date.parse(v.before),'Invalid time range');
export const insightInputSchema=askInputSchema.innerType().extend({question:z.string().trim().min(1).max(8000).optional(),prompt:z.string().trim().max(8000).optional()}).strict().refine(v=>!v.question||!v.prompt,'Choose one prompt').transform(({question,prompt,...value})=>askInputSchema.parse({...value,question:question||prompt||(value.language==='en'?'Review this period of personal context. Choose findings supported by evidence, distinguish facts, inferences and gaps, retain source citations and produce a complete personal-insight report and static HTML.':'请回顾这段时间的个人上下文，选择有证据支撑的发现。区分事实、推断与信息缺口，保留来源引用，用 personal-insight Skill 生成完整文字报告和静态 HTML 展示。')}));
export type AskInput=z.infer<typeof askInputSchema>;
export const askTaskSchema=z.object({runId:z.string().uuid(),generation:z.number().int().nonnegative(),fragment:z.number().int().nonnegative().optional(),unitId:z.string().min(1).max(128).optional(),mode:z.enum(['chat','insight','compact'])}).strict();
export type AskTask=z.infer<typeof askTaskSchema>;
export type AskScope={sourceIds?:readonly string[];assertCurrent:()=>void};
export type EvidencePin={id:string;hash:string;receipt?:string;kind?:'measurement'|'history'|'attachment';headId?:string;source?:{id:string;incarnation:string}};
export type MaterialPin={id:string;revision:string;sources?:{id:string;incarnation:string}[]};
export type AskRow={id:string;input:string;fingerprint:string;mode:'chat'|'insight'|'compact';status:string;generation:number;fragment:number;task_id:string|null;model:string;scope:string;context:string;conversation_revision:number;conversation_incarnation:string;pins:string;materials:string;memory_pins:string;events:string;workspace:string|null;request_bound:number;created_at:string;updated_at:string;result:string|null};
export function installAsk(db:DatabaseSync){db.function('ma_catalog_parent',{deterministic:true},catalogParent);db.exec(`
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
 CREATE TABLE IF NOT EXISTS ma_restore(user_id TEXT NOT NULL,operation_id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(user_id,operation_id));
 `);db.prepare('INSERT OR IGNORE INTO ma_meta VALUES(1,?)').run(randomBytes(32).toString('hex'));return String(db.prepare('SELECT cursor_key FROM ma_meta WHERE singleton=1').get()!.cursor_key);}

/** Host-only M05 validation, before a task context exists. Owner comes only from the engine's durable ownership record. */
export function persistedAskRun(db:DatabaseSync,userId:string,id:string){return db.prepare('SELECT * FROM ma_runs WHERE user_id=? AND id=?').get(userId,id) as AskRow|undefined;}
export function askUserDeleted(db:DatabaseSync,userId:string){return Boolean(db.prepare('SELECT 1 FROM ma_state WHERE user_id=? AND deleted=1').get(userId));}
