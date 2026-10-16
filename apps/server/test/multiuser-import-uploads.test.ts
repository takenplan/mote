import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {buildApp} from '../src/app.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';

// Original generic import client protocol, through actual Accounts/production
// HTTP/SQLite/M03 originals. No unconfirmed capture or Material is published.
test('generic upload ACKs persist across restart, deduplicate exact parts and keep equal upload IDs private until explicit import',async t=>{
 const f=await scopedFilesFixture(t),id=randomUUID(),a=Buffer.from('Generated A archived import bytes'),b=Buffer.from('Generated B archived import bytes');
 const manifest={id,name:'generated/facts.txt',sizeBytes:a.length,mimeType:'text/plain'};
 const begin=await f.checked(f.a.token,'/api/import-uploads','POST',manifest);assert.equal(begin.id,id);assert.equal(begin.partBytes,4*1024*1024);assert.deepEqual(begin.parts,[]);
 await f.checked(f.b.token,'/api/import-uploads','POST',manifest);
 assert.equal((await f.request(f.a.token,'/api/import-uploads','POST',{...manifest,name:'changed.txt'})).statusCode,409);
 assert.equal((await f.request(f.a.token,'/api/import-uploads/'+id+'/commit','POST',{})).statusCode,409);
 const path='/api/import-uploads/'+id+'/parts/0',headers={'content-type':'application/octet-stream'};
 const part=await f.request(f.a.token,path,'PUT',a,headers);assert.equal(part.statusCode,200,part.body);
 assert.deepEqual((await f.request(f.a.token,path,'PUT',a,headers)).json(),part.json());
 assert.equal((await f.request(f.a.token,path,'PUT',Buffer.alloc(a.length,1),headers)).statusCode,409);
 assert.equal((await f.request(f.b.token,path,'PUT',b,headers)).statusCode,200);
 const fileA=await f.checked(f.a.token,'/api/import-uploads/'+id+'/commit','POST',{}),fileB=await f.checked(f.b.token,'/api/import-uploads/'+id+'/commit','POST',{});
 assert.equal(fileA.relativePath,manifest.name);assert.equal(fileA.name,'facts.txt');assert.equal(fileA.sizeBytes,a.length);assert.notEqual(fileA.id,fileB.id);
 assert.equal((await f.checked(f.a.token,'/api/import-uploads','POST',manifest)).fileId,fileA.id);
 assert.equal((await f.request(f.a.token,'/api/archived-files/'+fileA.id+'/content')).rawPayload.toString(),a.toString());
 assert.equal((await f.request(f.b.token,'/api/archived-files/'+fileA.id+'/content')).statusCode,404);
 assert.equal((await f.request(f.admin.token,'/api/archived-files/'+fileA.id)).statusCode,404);
 assert.deepEqual((await f.checked(f.a.token,'/api/files')).items,[]);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) n FROM pd_captures').get()!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM pd_materials').get()!.n,0);}finally{db.close();}
 await f.host.app.close();const restarted=await buildApp({dataDir:f.directory});try{
  const headers={authorization:'Bearer '+f.a.token,'x-mote-protocol-version':'2'};
  const replay=await restarted.app.inject({method:'POST',url:'/api/import-uploads',headers,payload:manifest});assert.equal(replay.statusCode,200,replay.body);assert.equal(replay.json().fileId,fileA.id);
  const content=await restarted.app.inject({url:'/api/archived-files/'+fileA.id+'/content',headers});assert.equal(content.statusCode,200,content.body);assert.deepEqual(content.rawPayload,a);
 }finally{await restarted.app.close();}
});
