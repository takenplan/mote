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
export function installActions(db:DatabaseSync){db.exec(`
 CREATE TABLE IF NOT EXISTS ac_meta(id INTEGER PRIMARY KEY CHECK(id=1),cursor_key TEXT NOT NULL,installation_epoch TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS ac_state(user_id TEXT PRIMARY KEY,deleted INTEGER NOT NULL DEFAULT 0,generation INTEGER NOT NULL DEFAULT 0,settings TEXT NOT NULL DEFAULT '{"enabled":false,"timeZone":"Asia/Shanghai"}',authorization_revision INTEGER NOT NULL DEFAULT 0,review_devices TEXT NOT NULL DEFAULT '[]',policy_id TEXT,policy_task TEXT);
 CREATE TABLE IF NOT EXISTS ac_sources(user_id TEXT NOT NULL,id TEXT NOT NULL,epoch TEXT NOT NULL,PRIMARY KEY(user_id,id));
 INSERT OR IGNORE INTO ac_sources SELECT user_id,id,lower(hex(randomblob(16))) FROM pd_sources;
 CREATE TRIGGER IF NOT EXISTS ac_source_insert AFTER INSERT ON pd_sources BEGIN INSERT INTO ac_sources VALUES(new.user_id,new.id,lower(hex(randomblob(16)))) ON CONFLICT(user_id,id) DO UPDATE SET epoch=excluded.epoch; END;
 CREATE TRIGGER IF NOT EXISTS ac_source_update AFTER UPDATE ON pd_sources WHEN new.json!=old.json BEGIN UPDATE ac_sources SET epoch=lower(hex(randomblob(16))) WHERE user_id=new.user_id AND id=new.id; END;
 CREATE TRIGGER IF NOT EXISTS ac_source_delete AFTER DELETE ON pd_sources BEGIN DELETE FROM ac_sources WHERE user_id=old.user_id AND id=old.id; END;
 CREATE TABLE IF NOT EXISTS ac_proposals(user_id TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,proof TEXT NOT NULL,scope TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE INDEX IF NOT EXISTS ac_proposal_page ON ac_proposals(user_id,created_at DESC,id DESC);
 CREATE TABLE IF NOT EXISTS ac_targets(user_id TEXT NOT NULL,device_id TEXT NOT NULL,epoch TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,device_id));
 CREATE TABLE IF NOT EXISTS ac_jobs(user_id TEXT NOT NULL,id TEXT NOT NULL,input TEXT NOT NULL,proof TEXT NOT NULL,task_id TEXT,state TEXT NOT NULL DEFAULT 'pending',PRIMARY KEY(user_id,id));
 CREATE TABLE IF NOT EXISTS ac_operations(user_id TEXT NOT NULL,id TEXT NOT NULL,action_id TEXT NOT NULL,approval_hash TEXT NOT NULL,target_epoch TEXT,authorization_revision INTEGER NOT NULL,account_epoch INTEGER NOT NULL,task_id TEXT,issuance_id TEXT,claimed INTEGER NOT NULL DEFAULT 0,ack TEXT,revoked INTEGER NOT NULL DEFAULT 0,published INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,id),FOREIGN KEY(user_id,action_id) REFERENCES ac_proposals(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS ac_restore(user_id TEXT NOT NULL,id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(user_id,id));
 `);db.prepare('INSERT OR IGNORE INTO ac_meta VALUES(1,?,?)').run(randomBytes(32).toString('hex'),randomUUID());return db.prepare('SELECT cursor_key,installation_epoch FROM ac_meta WHERE id=1').get() as {cursor_key:string;installation_epoch:string};}
