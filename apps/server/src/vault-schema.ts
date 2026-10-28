import type {DatabaseSync} from 'node:sqlite';

/** Vault settings; the epoch check remains the responsibility of the opening store. */
export function vaultSchema(db:DatabaseSync){db.exec(`
 CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);}
