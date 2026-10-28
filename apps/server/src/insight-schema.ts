import type {DatabaseSync} from 'node:sqlite';

/** Insight owns its persisted results. */
export function insightSchema(db:DatabaseSync){db.exec(`
 CREATE TABLE IF NOT EXISTS insights (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, json TEXT NOT NULL);
`);}
