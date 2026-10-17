import type {DatabaseSync} from 'node:sqlite';
export function installMcp(db:DatabaseSync){db.exec(`
 CREATE TABLE IF NOT EXISTS mc_state(user_id TEXT PRIMARY KEY,deleted INTEGER NOT NULL DEFAULT 0,generation INTEGER NOT NULL DEFAULT 0,fingerprint TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS mc_manifests(user_id TEXT NOT NULL,connection_id TEXT NOT NULL,source_id TEXT NOT NULL,identity TEXT NOT NULL,members TEXT NOT NULL,PRIMARY KEY(user_id,connection_id,source_id,identity));
 CREATE TABLE IF NOT EXISTS mc_source_status(user_id TEXT NOT NULL,source_id TEXT NOT NULL,source_epoch INTEGER NOT NULL,connection_id TEXT NOT NULL,fingerprint TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,source_id));
 CREATE TABLE IF NOT EXISTS mc_source_epochs(user_id TEXT NOT NULL,source_id TEXT NOT NULL,epoch INTEGER NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(user_id,source_id));
 INSERT OR IGNORE INTO mc_source_epochs SELECT user_id,id,1,1 FROM pd_sources;
 CREATE TRIGGER IF NOT EXISTS mc_source_insert AFTER INSERT ON pd_sources BEGIN
  INSERT INTO mc_source_epochs VALUES(new.user_id,new.id,1,1) ON CONFLICT(user_id,source_id) DO UPDATE SET epoch=epoch+1,revision=revision+1;
 END;
 CREATE TRIGGER IF NOT EXISTS mc_source_update AFTER UPDATE ON pd_sources BEGIN
  UPDATE mc_source_epochs SET revision=revision+1 WHERE user_id=new.user_id AND source_id=new.id;
 END;
 CREATE TRIGGER IF NOT EXISTS mc_source_delete AFTER DELETE ON pd_sources BEGIN
  UPDATE mc_source_epochs SET epoch=epoch+1,revision=revision+1 WHERE user_id=old.user_id AND source_id=old.id;
 END;
 `);}
