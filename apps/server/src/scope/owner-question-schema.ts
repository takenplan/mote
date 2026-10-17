import type {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
export function installOwnerQuestions(db:DatabaseSync){db.exec(`
 CREATE TABLE IF NOT EXISTS oq_meta(id INTEGER PRIMARY KEY CHECK(id=1),cursor_key TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS oq_state(user_id TEXT PRIMARY KEY,deleted INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS oq_questions(user_id TEXT NOT NULL,id TEXT NOT NULL,identity TEXT NOT NULL,epoch TEXT NOT NULL,json TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,id),UNIQUE(user_id,identity));
 CREATE TABLE IF NOT EXISTS oq_dependencies(user_id TEXT NOT NULL,question_id TEXT NOT NULL,evidence_id TEXT NOT NULL,PRIMARY KEY(user_id,question_id,evidence_id),FOREIGN KEY(user_id,question_id) REFERENCES oq_questions(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS oq_replies(user_id TEXT NOT NULL,question_id TEXT NOT NULL,request_id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(user_id,question_id,request_id),FOREIGN KEY(user_id,question_id) REFERENCES oq_questions(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS oq_restore(user_id TEXT NOT NULL,id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(user_id,id));
 CREATE TRIGGER IF NOT EXISTS oq_capture_deleted BEFORE DELETE ON pd_captures BEGIN DELETE FROM oq_questions WHERE user_id=old.user_id AND id IN(SELECT question_id FROM oq_dependencies WHERE user_id=old.user_id AND evidence_id=old.id); END;
 CREATE TRIGGER IF NOT EXISTS oq_material_deleted BEFORE DELETE ON pd_materials BEGIN DELETE FROM oq_questions WHERE user_id=old.user_id AND json_extract(json,'$.question.materialId')=old.id; END;
 `);db.prepare('INSERT OR IGNORE INTO oq_meta VALUES(1,?)').run(randomBytes(32).toString('hex'));return String(db.prepare('SELECT cursor_key FROM oq_meta WHERE id=1').get()!.cursor_key);}
