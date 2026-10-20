import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {memorySearchQuery} from '../src/memory-search-query.js';
import {reconcileMemorySearchProjection} from '../src/scope/memory-schema.js';

test('current Memory projection repairs existing two-field FTS and triggers atomically without a second write',t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`CREATE TABLE mm_records(user_id TEXT,id TEXT,json TEXT,PRIMARY KEY(user_id,id));
  CREATE VIRTUAL TABLE mm_fts USING fts5(user_id UNINDEXED,id UNINDEXED,text,tokenize='trigram');
  CREATE TRIGGER mm_index_insert AFTER INSERT ON mm_records BEGIN INSERT INTO mm_fts VALUES(new.user_id,new.id,json_extract(new.json,'$.title')||' '||json_extract(new.json,'$.statement')); END;
  CREATE TRIGGER mm_index_update AFTER UPDATE ON mm_records BEGIN DELETE FROM mm_fts WHERE user_id=old.user_id AND id=old.id;INSERT INTO mm_fts VALUES(new.user_id,new.id,json_extract(new.json,'$.title')||' '||json_extract(new.json,'$.statement')); END;
  CREATE TRIGGER mm_index_delete AFTER DELETE ON mm_records BEGIN DELETE FROM mm_fts WHERE user_id=old.user_id AND id=old.id; END;`);
 const put=db.prepare('INSERT INTO mm_records VALUES(?,?,?)'),body=(uncertainty:string)=>JSON.stringify({title:'Alpha',statement:'Generated separate statement',uncertainty});
 put.run('A','same',body('Omega xy'));put.run('B','same',body('PRIVATE_B_ONLY'));put.run('A','missing',body('Missing uncertainty'));
 db.exec("DELETE FROM mm_fts WHERE id='missing';INSERT INTO mm_fts VALUES('A','orphan','orphan');INSERT INTO mm_fts VALUES('A','same','Alpha Generated separate statement Omega xy');INSERT INTO mm_fts VALUES('A','same','Alpha Generated separate statement Omega xy');");
 reconcileMemorySearchProjection(db);
 assert.equal(db.prepare('SELECT count(*) n FROM mm_fts').get()!.n,3);
 const hits=(owner:string,query:string)=>db.prepare('SELECT id FROM mm_fts WHERE user_id=? AND mm_fts MATCH ? ORDER BY id').all(owner,query).map(row=>row.id);
 assert.deepEqual(hits('A','"Alpha" AND "Omega"'),['same']);assert.deepEqual(hits('A','"PRIVATE_B_ONLY"'),[]);assert.deepEqual(hits('B','"PRIVATE_B_ONLY"'),['same']);
 const schema=db.prepare('PRAGMA schema_version').get()!.schema_version,changes=db.prepare('SELECT total_changes() n').get()!.n;
 reconcileMemorySearchProjection(db);assert.equal(db.prepare('SELECT total_changes() n').get()!.n,changes);assert.equal(db.prepare('PRAGMA schema_version').get()!.schema_version,schema);
 put.run('A','new',body('INSERT_ONLY'));assert.deepEqual(hits('A','"INSERT_ONLY"'),['new']);
 db.prepare('UPDATE mm_records SET json=? WHERE user_id=? AND id=?').run(body('UPDATE_ONLY'),'A','new');assert.deepEqual(hits('A','"INSERT_ONLY"'),[]);assert.deepEqual(hits('A','"UPDATE_ONLY"'),['new']);
 db.prepare('DELETE FROM mm_records WHERE user_id=? AND id=?').run('A','new');assert.deepEqual(hits('A','"UPDATE_ONLY"'),[]);
 db.exec('BEGIN');reconcileMemorySearchProjection(db);assert.equal(db.isTransaction,true,'the projection participates in its caller transaction');db.exec('ROLLBACK');
});

test('Memory literal query preparation retains Unicode AND, short terms, quoting and the original twelve-term bound',()=>{
 assert.deepEqual(memorySearchQuery('  alpha xy 你好世界 甲 a"b  '),{match:'"alpha" AND "你好世界" AND "a""b"',short:['xy','甲']});
 assert.equal(memorySearchQuery(Array.from({length:15},(_,i)=>'term'+i).join(' ')).match!.split(' AND ').length,12);
});
