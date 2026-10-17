import {StoreError,type ExecutionStorage} from './execution-storage.js';
const states=['waiting','running','blocked','succeeded','failed','cancelled','stale'] as const;
export type OperationMembership={generation?:{slot:string;version:string};optional?:boolean};
/** Fresh current-definition projections. Step state and historical links remain durable. */
export function installOperationProjection(store:ExecutionStorage){
 const db=store.db;
 const scheduledSkip=(step:string)=>`(${step}.state='blocked' AND coalesce(${step}.error IN ('summary_disabled','archive_only','appledouble_metadata'),0))`;
 db.exec('CREATE TABLE IF NOT EXISTS execution_projection_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const version='3',dbVersion=db.prepare("SELECT value FROM execution_projection_meta WHERE key='operation-projection-version'").get()?.value;
 if(dbVersion!==version)db.exec('DROP TRIGGER IF EXISTS operation_link_added; DROP TRIGGER IF EXISTS operation_link_changed; DROP TRIGGER IF EXISTS operation_link_removed; DROP TRIGGER IF EXISTS operation_step_changed; DROP TRIGGER IF EXISTS operation_step_removed; DROP TRIGGER IF EXISTS operation_changed; DROP TRIGGER IF EXISTS operation_created; DROP TRIGGER IF EXISTS operation_changes_bounded;');
 const excluded=(state:string,optional:string)=>`(${optional} AND ${state} IN ('blocked','failed','cancelled','stale'))`;
 const applyLink=(alias:'old'|'new',sign:'+'|'-')=>`UPDATE operation_progress SET total=total${sign}${alias}.active,not_scheduled=not_scheduled${sign}(${alias}.active AND ${alias}.optional AND (SELECT ${scheduledSkip('e')} FROM execution_steps e WHERE e.id=${alias}.step_id)),${states.map(state=>`${state}=${state}${sign}(${alias}.active AND NOT ${excluded(`(SELECT state FROM execution_steps WHERE id=${alias}.step_id)`,`${alias}.optional`)} AND (SELECT state FROM execution_steps WHERE id=${alias}.step_id)='${state}')`).join(',')},updated_at=max(updated_at,coalesce((SELECT updated_at FROM execution_steps WHERE id=${alias}.step_id),updated_at)) WHERE id=${alias}.operation_id;`;
 const applyState=(alias:'old'|'new',sign:'+'|'-')=>`UPDATE operation_progress SET not_scheduled=not_scheduled${sign}(coalesce((SELECT optional FROM execution_operation_steps WHERE operation_id=operation_progress.id AND step_id=${alias}.id AND active=1),0) AND ${scheduledSkip(alias)}),${states.map(state=>`${state}=${state}${sign}(${alias}.state='${state}' AND NOT ${excluded(`${alias}.state`,`coalesce((SELECT optional FROM execution_operation_steps WHERE operation_id=operation_progress.id AND step_id=${alias}.id),0)`)} )`).join(',')},updated_at=max(updated_at,new.updated_at) WHERE id IN (SELECT operation_id FROM execution_operation_steps WHERE step_id=${alias}.id AND active=1);`;
 db.exec(`CREATE TABLE IF NOT EXISTS operation_progress(id TEXT PRIMARY KEY,user_id TEXT NOT NULL DEFAULT '',user_position INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,total INTEGER NOT NULL DEFAULT 0,not_scheduled INTEGER NOT NULL DEFAULT 0,${states.map(state=>state+' INTEGER NOT NULL DEFAULT 0').join(',')},state TEXT GENERATED ALWAYS AS (CASE WHEN total=not_scheduled THEN 'skipped' WHEN running>0 THEN 'running' WHEN waiting>0 THEN 'waiting' WHEN failed>0 THEN 'failed' WHEN blocked>0 THEN 'blocked' WHEN stale>0 THEN 'stale' WHEN cancelled>0 THEN 'cancelled' ELSE 'succeeded' END) STORED,kind TEXT GENERATED ALWAYS AS (substr(id,1,instr(id,':')-1)) STORED);
   CREATE INDEX IF NOT EXISTS operation_progress_filter ON operation_progress(state,created_at,id);
   CREATE INDEX IF NOT EXISTS operation_progress_kind ON operation_progress(kind,created_at,id);
   CREATE INDEX IF NOT EXISTS operation_membership_generation ON execution_operation_steps(operation_id,slot,generation,active);
   CREATE TABLE IF NOT EXISTS operation_generations(operation_id TEXT NOT NULL,slot TEXT NOT NULL,version TEXT NOT NULL,PRIMARY KEY(operation_id,slot));
   CREATE TABLE IF NOT EXISTS operation_changes(seq INTEGER PRIMARY KEY AUTOINCREMENT,operation_id TEXT NOT NULL,user_id TEXT NOT NULL DEFAULT '',user_seq INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS operation_user_sequences(user_id TEXT PRIMARY KEY,next_position INTEGER NOT NULL DEFAULT 0,next_change INTEGER NOT NULL DEFAULT 0);`);
 const change="INSERT INTO operation_user_sequences(user_id,next_change) VALUES(new.user_id,1) ON CONFLICT(user_id) DO UPDATE SET next_change=next_change+1; INSERT INTO operation_changes(operation_id,user_id,user_seq) SELECT new.id,new.user_id,next_change FROM operation_user_sequences WHERE user_id=new.user_id;";
 db.exec(`CREATE INDEX IF NOT EXISTS operation_user_position ON operation_progress(user_id,user_position);
   CREATE UNIQUE INDEX IF NOT EXISTS operation_user_changes ON operation_changes(user_id,user_seq);
   CREATE TRIGGER IF NOT EXISTS operation_changes_bounded AFTER INSERT ON operation_changes BEGIN DELETE FROM operation_changes WHERE user_id=new.user_id AND user_seq<new.user_seq-100000; END;
   CREATE TRIGGER IF NOT EXISTS operation_link_added AFTER INSERT ON execution_operation_steps BEGIN
    INSERT INTO operation_user_sequences(user_id,next_position) SELECT user_id,1 FROM execution_steps WHERE id=new.step_id AND NOT EXISTS(SELECT 1 FROM operation_progress WHERE id=new.operation_id) ON CONFLICT(user_id) DO UPDATE SET next_position=next_position+1;
    INSERT OR IGNORE INTO operation_progress(id,user_id,user_position,created_at,updated_at) SELECT new.operation_id,e.user_id,u.next_position,e.created_at,e.updated_at FROM execution_steps e JOIN operation_user_sequences u ON u.user_id=e.user_id WHERE e.id=new.step_id;
    ${applyLink('new','+')}
   END;
   CREATE TRIGGER IF NOT EXISTS operation_link_changed AFTER UPDATE OF active,optional,generation ON execution_operation_steps BEGIN ${applyLink('old','-')} ${applyLink('new','+')} END;
   CREATE TRIGGER IF NOT EXISTS operation_link_removed BEFORE DELETE ON execution_operation_steps BEGIN ${applyLink('old','-')} END;
   CREATE TRIGGER IF NOT EXISTS operation_step_changed AFTER UPDATE OF state,updated_at ON execution_steps BEGIN ${applyState('old','-')} ${applyState('new','+')} END;
   CREATE TRIGGER IF NOT EXISTS operation_step_removed BEFORE DELETE ON execution_steps BEGIN DELETE FROM execution_operation_steps WHERE step_id=old.id; END;
   CREATE TRIGGER IF NOT EXISTS operation_changed AFTER UPDATE ON operation_progress BEGIN ${change} END;
   CREATE TRIGGER IF NOT EXISTS operation_created AFTER INSERT ON operation_progress BEGIN ${change} END;`);
 if(dbVersion!==version){
  db.exec(`UPDATE operation_progress SET not_scheduled=(SELECT count(*) FROM execution_operation_steps o JOIN execution_steps e ON e.id=o.step_id WHERE o.operation_id=operation_progress.id AND o.active=1 AND o.optional=1 AND ${scheduledSkip('e')});`);
  db.prepare("INSERT INTO execution_projection_meta VALUES('operation-projection-version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(version);
 }
 installOperationHierarchy(store);
}
export function linkOperation(store:ExecutionStorage,operationId:string,stepId:string,membership:OperationMembership={}){
 const db=store.db,slot=membership.generation?.slot??'',version=membership.generation?.version??'';
 const own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');
 try{
 const step=db.prepare('SELECT user_id FROM execution_steps WHERE id=?').get(stepId);if(!step)throw new StoreError('Execution step unavailable',409);
 // Parent links may precede child creation. Check every existing ancestor now,
 // before triggers propagate membership into its private projection.
 if(db.prepare('WITH RECURSIVE ancestors(id) AS (SELECT ? UNION SELECT parent_id FROM operation_parents JOIN ancestors ON child_id=ancestors.id) SELECT 1 FROM operation_progress p JOIN ancestors a ON a.id=p.id WHERE p.user_id!=? LIMIT 1').get(operationId,step.user_id))throw new StoreError('Execution operation ownership conflict',409);
 if(membership.generation){
  const prior=db.prepare('SELECT version FROM operation_generations WHERE operation_id=? AND slot=?').get(operationId,slot);
  if(prior?.version!==version){
   db.prepare('INSERT INTO operation_generations VALUES(?,?,?) ON CONFLICT(operation_id,slot) DO UPDATE SET version=excluded.version').run(operationId,slot,version);
   db.prepare('UPDATE execution_operation_steps SET active=(generation=?) WHERE operation_id=? AND slot=? AND active!=(generation=?)').run(version,operationId,slot,version);
  }
 }
 db.prepare('INSERT INTO execution_operation_steps(operation_id,step_id,slot,generation,optional,active) VALUES(?,?,?,?,?,1) ON CONFLICT(operation_id,step_id) DO UPDATE SET slot=excluded.slot,generation=excluded.generation,optional=excluded.optional,active=1 WHERE slot!=excluded.slot OR generation!=excluded.generation OR optional!=excluded.optional OR active!=1').run(operationId,stepId,slot,version,Number(membership.optional??false));
 if(own)db.exec('COMMIT');
 }catch(error){if(own&&db.isTransaction)db.exec('ROLLBACK');throw error;}
}

/** Durable parent attribution copies membership, never execution state. Later
 * child admission, generation changes and deletion reach the parent atomically. */
function installOperationHierarchy(store:ExecutionStorage){
 const db=store.db;
 db.exec(`CREATE TABLE IF NOT EXISTS operation_parents(parent_id TEXT NOT NULL,child_id TEXT NOT NULL,PRIMARY KEY(parent_id,child_id));
 CREATE INDEX IF NOT EXISTS operation_parent_children ON operation_parents(child_id,parent_id);
 CREATE TRIGGER IF NOT EXISTS operation_child_added AFTER INSERT ON execution_operation_steps BEGIN
  INSERT OR IGNORE INTO execution_operation_steps(operation_id,step_id,slot,generation,active,optional)
   SELECT parent_id,new.step_id,new.operation_id||':'||new.slot,new.generation,new.active,new.optional FROM operation_parents WHERE child_id=new.operation_id;
 END;
 CREATE TRIGGER IF NOT EXISTS operation_child_changed AFTER UPDATE OF active,optional,generation ON execution_operation_steps BEGIN
  UPDATE execution_operation_steps SET active=new.active,optional=new.optional,generation=new.generation WHERE step_id=new.step_id AND operation_id IN (SELECT parent_id FROM operation_parents WHERE child_id=new.operation_id);
 END;
 CREATE TRIGGER IF NOT EXISTS operation_child_removed AFTER DELETE ON execution_operation_steps BEGIN
  DELETE FROM execution_operation_steps WHERE step_id=old.step_id AND operation_id IN (SELECT parent_id FROM operation_parents WHERE child_id=old.operation_id);
 END;`);
}
export function linkOperationParent(store:ExecutionStorage,parentId:string,childId:string){
 const db=store.db;
 const own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');
 try{
 const owners=db.prepare('WITH RECURSIVE ancestors(id) AS (SELECT ? UNION SELECT parent_id FROM operation_parents JOIN ancestors ON child_id=ancestors.id),descendants(id) AS (SELECT ? UNION SELECT child_id FROM operation_parents JOIN descendants ON parent_id=descendants.id) SELECT DISTINCT user_id FROM operation_progress WHERE id IN (SELECT id FROM ancestors UNION SELECT id FROM descendants)').all(parentId,childId);
 if(owners.length>1)throw new StoreError('Execution operation ownership conflict',409);
 if(parentId===childId)throw Error('An operation cannot contain itself');
 if(db.prepare('WITH RECURSIVE descendants(id) AS (SELECT child_id FROM operation_parents WHERE parent_id=? UNION SELECT p.child_id FROM operation_parents p JOIN descendants d ON p.parent_id=d.id) SELECT 1 FROM descendants WHERE id=? LIMIT 1').get(childId,parentId))throw Error('Operation ancestry cycle');
 if(db.prepare('SELECT 1 FROM operation_parents WHERE parent_id=? AND child_id=?').get(parentId,childId)){if(own)db.exec('COMMIT');return;}
  store.reserveMetadata(Buffer.byteLength(parentId)+Buffer.byteLength(childId)+256);
  db.prepare('INSERT INTO operation_parents VALUES(?,?)').run(parentId,childId);
  db.prepare("INSERT OR IGNORE INTO execution_operation_steps(operation_id,step_id,slot,generation,active,optional) SELECT ?,step_id,operation_id||':'||slot,generation,active,optional FROM execution_operation_steps WHERE operation_id=?").run(parentId,childId);
  if(own)db.exec('COMMIT');
 }catch(error){if(own)db.exec('ROLLBACK');throw error;}
}
