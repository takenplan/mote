import type {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
export function installTodos(db:DatabaseSync){
  db.exec(`CREATE TABLE IF NOT EXISTS td_meta(id INTEGER PRIMARY KEY CHECK(id=1),cursor_key TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS td_state(user_id TEXT PRIMARY KEY,deleted INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS td_todos(user_id TEXT NOT NULL,id TEXT NOT NULL,created_at TEXT NOT NULL,status TEXT NOT NULL,version INTEGER NOT NULL,request_hash TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,id));
   CREATE INDEX IF NOT EXISTS td_page ON td_todos(user_id,status,created_at DESC,id DESC);
   CREATE TABLE IF NOT EXISTS td_restore(user_id TEXT NOT NULL,id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(user_id,id));`);
  db.prepare('INSERT OR IGNORE INTO td_meta VALUES(1,?)').run(randomBytes(32).toString('hex'));return String(db.prepare('SELECT cursor_key FROM td_meta').get()!.cursor_key);
}
export const todosDeleted=(db:DatabaseSync,userId:string)=>Boolean(db.prepare('SELECT deleted FROM td_state WHERE user_id=?').get(userId)?.deleted);
