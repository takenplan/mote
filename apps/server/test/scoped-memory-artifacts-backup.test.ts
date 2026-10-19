import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {backupScopedInstance,verifiedScopedBackup} from '../../../scripts/scoped-backup.mjs';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';

test('a stopped Memory backup preserves successful private checkpoints and rejects a missing artifact table or column',async t=>{
 const f=await scopedMemoryFixture(t),root=mkdtempSync(join(tmpdir(),'mote-memory-artifact-backup-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const created=await f.submit(f.a,[(await f.publish(f.a,'A')).id]);await f.wait(f.a,created.id);
 const before=f.read(db=>db.prepare('SELECT * FROM mm_batch_artifacts ORDER BY user_id,job_id,batch_id,kind').all());assert.ok(before.some(row=>row.kind==='saved'));assert.ok(before.some(row=>row.kind==='memory-catalog'));await f.node.app.close();const snapshot=join(root,'complete');await backupScopedInstance({source:f.directory,out:snapshot});await verifiedScopedBackup(snapshot);
 const copied=new DatabaseSync(join(snapshot,'mote.sqlite'),{readOnly:true});try{assert.deepEqual(copied.prepare('SELECT * FROM mm_batch_artifacts ORDER BY user_id,job_id,batch_id,kind').all(),before);}finally{copied.close();}
 for(const field of ['table','user_id','job_id','batch_id','kind','json'])await t.test(field,async()=>{
  const damaged=join(root,'missing-'+field);cpSync(snapshot,damaged,{recursive:true});const db=new DatabaseSync(join(damaged,'mote.sqlite'));try{db.exec(field==='table'?'DROP TABLE mm_batch_artifacts':'ALTER TABLE mm_batch_artifacts RENAME COLUMN '+field+' TO generated_missing_column');}finally{db.close();}
  const manifestFile=join(damaged,'backup-manifest.json'),manifest=JSON.parse(readFileSync(manifestFile,'utf8'));manifest.checksums['mote.sqlite']=createHash('sha256').update(readFileSync(join(damaged,'mote.sqlite'))).digest('hex');writeFileSync(manifestFile,JSON.stringify(manifest));await assert.rejects(verifiedScopedBackup(damaged),/Incomplete instance domain database/);
  const source=join(root,'source-'+field),out=join(root,'rejected-'+field);cpSync(f.directory,source,{recursive:true});const sourceDb=new DatabaseSync(join(source,'mote.sqlite'));try{sourceDb.exec(field==='table'?'DROP TABLE mm_batch_artifacts':'ALTER TABLE mm_batch_artifacts RENAME COLUMN '+field+' TO generated_missing_column');}finally{sourceDb.close();}await assert.rejects(backupScopedInstance({source,out}),/Incomplete instance domain database/);assert.equal(existsSync(out),false);
 });
});
