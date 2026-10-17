import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openGeneratedMemoryProviderDb} from './fixtures/generated-memory-provider-db.js';

test('generated Memory provider reads a real concurrent host commit without turning SQLite contention into transport failure',{timeout:10000},async()=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-generated-provider-lock-')),path=join(directory,'generated.sqlite');
 const initial=new DatabaseSync(path);initial.exec("CREATE TABLE generated(value TEXT);INSERT INTO generated VALUES('before')");initial.close();
 const child=spawn(process.execPath,['--input-type=module','-e',`
  import {DatabaseSync} from 'node:sqlite';
  const db=new DatabaseSync(process.argv[1]);db.exec("BEGIN EXCLUSIVE;UPDATE generated SET value='after'");
  console.log('locked');setTimeout(()=>{db.exec('COMMIT');db.close();},200);
 `,path],{stdio:['ignore','pipe','pipe'],timeout:5000});
 const closed=new Promise<{code:number|null;signal:NodeJS.Signals|null}>(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
 try{
  await new Promise<void>((resolve,reject)=>{child.stdout.once('data',()=>resolve());child.once('error',reject);child.once('exit',code=>reject(Error('Generated writer exited before readiness: '+code)));});
  const db=openGeneratedMemoryProviderDb(path);
  try{
   assert.equal(db.prepare('SELECT value FROM generated').get()!.value,'after');
   assert.throws(()=>db.exec("INSERT INTO generated VALUES('forbidden')"),error=>(error as {errcode?:number}).errcode===8,'a generated model must retain read-only database access');
   assert.throws(()=>db.prepare('SELECT value FROM absent_generated_table').get(),error=>(error as {errcode?:number}).errcode===1,'permanent SQL errors must still propagate');
  }finally{db.close();}
  assert.deepEqual(await closed,{code:0,signal:null});
 }finally{
  if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
  await closed;rmSync(directory,{recursive:true,force:true});
 }
});
