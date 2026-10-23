import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scopedBackupSchema} from '../../../scripts/scoped-backup-schema.mjs';
import {backupScopedInstance} from '../../../scripts/scoped-backup.mjs';
import {installPrivateData} from '../src/scope/private-data-schema.js';
import {installIngress} from '../src/scope/ingress-schema.js';
import {installProcessing} from '../src/scope/processing-schema.js';
import {TaskExecution} from '../src/scope/task-execution.js';
import {TaskAuthorization} from '../src/scope/task-authorization.js';
import {UserContextAuthority} from '../src/scope/context.js';
import {ScopedServices} from '../src/scope/services.js';
import type {Accounts} from '../src/scope/accounts.js';

const processingTables={
 mp_configuration_receipts:['user_id','sequence','json'],
 mp_configuration_targets:['user_id','original_id','sequence','receipt_id','json'],
 task_processing_config_handoffs:['task_id','user_id','antecedent_id','root_id','root_hash','original_ref','receipt_id','replacement_id'],
 task_processing_config_retirements:['handoff_id','task_id'],
};
test('current processing backup declarations match actual installed Processing and TaskHost columns',async()=>{
 const db=new DatabaseSync(':memory:');installPrivateData(db);installIngress(db);installProcessing(db);const accounts={assertAccountEnabled:()=>assert.fail('schema installation cannot issue authority')} as unknown as Accounts,grants=new TaskAuthorization(db,accounts,'generated-backup-schema'),authority=new UserContextAuthority('generated-backup-schema',{verify:async()=>undefined,isCurrent:()=>false},grants),execution=new TaskExecution(db,authority,new ScopedServices(authority),grants);
 try{for(const [table,columns] of Object.entries(processingTables)){assert.deepEqual(scopedBackupSchema[table],columns);assert.deepEqual(db.prepare('PRAGMA table_info('+JSON.stringify(table)+')').all().map(row=>row.name),columns);}}finally{await execution.close();db.close();}
});
/** Generated complete catalogs exercise the existing module admission boundary;
 * they are not production-host or CLI restore lifecycle qualification. */
test('existing stopped backup utility rejects every missing processing authority table or required column without changing source bytes',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-processing-backup-schema-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const catalog=(name:string)=>{const source=join(directory,name);mkdirSync(source);writeFileSync(join(source,'instance.yaml'),'version: 1\nrevision: 0\n');const db=new DatabaseSync(join(source,'mote.sqlite'));try{for(const [table,columns] of Object.entries(scopedBackupSchema))db.exec('CREATE TABLE '+JSON.stringify(table)+'('+columns.map((column:string)=>JSON.stringify(column)).join(',')+')');db.exec("PRAGMA user_version=5;INSERT INTO scope_meta VALUES(1,5,'mote-private-users-v1','generated-processing-backup')");}finally{db.close();}return source;};
 const complete=catalog('complete'),completeBytes=readFileSync(join(complete,'mote.sqlite')),accepted=await backupScopedInstance({source:complete,out:join(directory,'accepted')});assert.equal(accepted.manifest.storageEpoch,5);assert.deepEqual(readFileSync(join(complete,'mote.sqlite')),completeBytes);
 for(const [table,columns] of Object.entries(processingTables))for(const missing of ['table',...columns])await t.test(table+':'+missing,async()=>{
  const name=table+'-'+missing,source=catalog(name),out=join(directory,'absent-'+name,'backup'),db=new DatabaseSync(join(source,'mote.sqlite'));try{db.exec(missing==='table'?'DROP TABLE '+JSON.stringify(table):'ALTER TABLE '+JSON.stringify(table)+' RENAME COLUMN '+JSON.stringify(missing)+' TO generated_missing_column');}finally{db.close();}
  const before={db:readFileSync(join(source,'mote.sqlite')),config:readFileSync(join(source,'instance.yaml')),files:readdirSync(source)};await assert.rejects(backupScopedInstance({source,out}),/Incomplete instance domain database/);assert.equal(existsSync(join(directory,'absent-'+name)),false);assert.deepEqual(readFileSync(join(source,'mote.sqlite')),before.db);assert.deepEqual(readFileSync(join(source,'instance.yaml')),before.config);assert.deepEqual(readdirSync(source),before.files);
 });
});
