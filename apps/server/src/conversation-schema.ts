import type {DatabaseSync} from 'node:sqlite';

/** Conversation metadata is installed with the vault; turn history is installed by Conversations. */
export function conversationSchema(db:DatabaseSync){db.exec(`
 CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY,title TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,json TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS conversations_updated ON conversations(updated_at DESC,id DESC);
`);}
