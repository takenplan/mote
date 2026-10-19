import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {openGeneratedMemoryProviderDb} from './fixtures/generated-memory-provider-db.js';

test('generated Memory observers wait for another real process to finish its SQLite transaction',{timeout:15000},async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-memory-observer-')),path=join(root,'generated.sqlite'),script=join(root,'writer.mjs'),initial=new DatabaseSync(path);initial.exec('CREATE TABLE generated_probe(value INTEGER); INSERT INTO generated_probe VALUES(1)');initial.close();
 writeFileSync(script,`import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync(${JSON.stringify(path)});db.exec('BEGIN EXCLUSIVE; UPDATE generated_probe SET value=2');process.send('held');process.once('message',()=>setTimeout(()=>{db.exec('COMMIT');db.close();process.disconnect();},150));`);
 const child=spawn(process.execPath,[script],{stdio:['ignore','pipe','pipe','ipc']}),closed=new Promise(resolve=>child.once('close',resolve));t.after(async()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await closed;rmSync(root,{recursive:true,force:true});});await new Promise<void>((resolve,reject)=>{child.once('message',()=>resolve());child.once('error',reject);});
 assert.throws(()=>{const unguarded=new DatabaseSync(path,{readOnly:true});try{unguarded.prepare('SELECT value FROM generated_probe').get();}finally{unguarded.close();}},/locked/,'the former zero-wait observer reproduces the frozen concurrent-run failure');
 child.send('release');const observer=openGeneratedMemoryProviderDb(path);try{assert.equal(observer.prepare('SELECT value FROM generated_probe').get()!.value,2);}finally{observer.close();}await closed;
});
