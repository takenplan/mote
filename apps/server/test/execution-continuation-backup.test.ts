import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {buildApp} from '../src/app.js';
import {backupScopedInstance,verifiedScopedBackup} from '../../../scripts/scoped-backup.mjs';

test('current continuous execution tables are required in stopped source and checksummed archive admission',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-continuation-backup-')),source=join(root,'vault'),node=await buildApp({dataDir:source});t.after(async()=>{await node.app.close();rmSync(root,{recursive:true,force:true});});await node.app.close();
 const snapshot=join(root,'complete');await backupScopedInstance({source,out:snapshot});await verifiedScopedBackup(snapshot);
 const contracts={execution_dynamic_resources:['step_id','resource_key','fence'],execution_resource_waits:['step_id','resource_key','fence','created_at'],execution_attempt_charges:['step_id','fence','charged']};
 for(const [table,columns] of Object.entries(contracts))for(const field of ['table',...columns])await t.test(table+':'+field,async()=>{
  const damaged=join(root,table+'-'+field);cpSync(snapshot,damaged,{recursive:true});const db=new DatabaseSync(join(damaged,'mote.sqlite'));
  try{db.exec(field==='table'?'DROP TABLE '+table:'ALTER TABLE '+table+' RENAME COLUMN '+field+' TO generated_missing_column');}finally{db.close();}
  const manifestFile=join(damaged,'backup-manifest.json'),manifest=JSON.parse(readFileSync(manifestFile,'utf8'));manifest.checksums['mote.sqlite']=createHash('sha256').update(readFileSync(join(damaged,'mote.sqlite'))).digest('hex');writeFileSync(manifestFile,JSON.stringify(manifest));await assert.rejects(verifiedScopedBackup(damaged),/Incomplete instance domain database/);
  const damagedSource=join(root,'source-'+table+'-'+field),out=join(root,'rejected-'+table+'-'+field);cpSync(source,damagedSource,{recursive:true});const sourceDb=new DatabaseSync(join(damagedSource,'mote.sqlite'));try{sourceDb.exec(field==='table'?'DROP TABLE '+table:'ALTER TABLE '+table+' RENAME COLUMN '+field+' TO generated_missing_column');}finally{sourceDb.close();}
  await assert.rejects(backupScopedInstance({source:damagedSource,out}),/Incomplete instance domain database/);assert.equal(existsSync(out),false);
 });
});
