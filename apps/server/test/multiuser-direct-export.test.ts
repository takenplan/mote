import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';

const noCopies=(directory:string)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'),{readOnly:true});try{assert.equal(db.prepare('SELECT COUNT(*) n FROM lifecycle_exports').get()!.n,0);}finally{db.close();}};
function holdMemory(f:Awaited<ReturnType<typeof scopedMemoryFixture>>){
 const hooks=(f.node.services as any).users.get('memory').lifecycle,original=hooks.exportUser;let entered!:()=>void,release!:()=>void;const ready=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>release=resolve);
 hooks.exportUser=async(subject:any)=>{const value=await original(subject);if(subject.userId===f.a.userId){entered();await gate;}return value;};f.beforeClose(()=>release());return {ready,release};
}
for(const owner of ['A','B'] as const)test('one direct full HTTP export uses exact owner dependencies while '+owner+' changes at an actual Memory await',async t=>{
 const f=await scopedMemoryFixture(t);await f.upload(f.a,'A');await f.upload(f.b,'B');const hold=holdMemory(f),pending=f.request(f.a.token,'/api/export');await hold.ready;
 const changed=await f.request(owner==='A'?f.a.token:f.b.token,'/api/sources/same-source','PATCH',{name:'Generated changed '+owner});assert.equal(changed.statusCode,200,changed.body);hold.release();const response=await pending;
 if(owner==='A')assert.equal(response.statusCode,409,response.body);else{assert.equal(response.statusCode,200,response.body);assert.equal(response.json().userId,f.a.userId);}
 noCopies(f.directory);
});

test('the current full download includes original bytes in one response, repeats without central copies and regenerates after erasure/restart',async t=>{
 const f=await scopedFilesFixture(t),a=await f.upload(f.a.token,'generated-a','GENERATED_A_ORIGINAL'),b=await f.upload(f.b.token,'generated-b','GENERATED_B_ORIGINAL');
 for(let repeat=0;repeat<3;repeat++){
  const response=await f.request(f.a.token,'/api/export');assert.equal(response.statusCode,200,response.body);const archive=response.json();assert.equal(archive.userId,f.a.userId);assert.equal(archive.coverage.credentials,false);assert.equal(archive.coverage.activeAuthorization,false);assert.ok(response.body.includes(Buffer.from('GENERATED_A_ORIGINAL').toString('base64')));assert.ok(!response.body.includes(Buffer.from('GENERATED_B_ORIGINAL').toString('base64')));assert.equal(Number(response.headers['content-length']),response.rawPayload.length);assert.equal(response.headers.etag,'"'+createHash('sha256').update(response.rawPayload).digest('hex')+'"');noCopies(f.directory);
 }
 const offline=await f.request(f.a.token,'/api/export'),offlineBytes=Buffer.from(offline.rawPayload);await f.checked(f.a.token,'/api/captures/'+a.id,'DELETE');await f.restart();const fresh=await f.request(f.a.token,'/api/export');assert.equal(fresh.statusCode,200,fresh.body);assert.ok(!fresh.body.includes(Buffer.from('GENERATED_A_ORIGINAL').toString('base64')));assert.deepEqual(offline.rawPayload,offlineBytes);assert.equal((await f.request(f.b.token,'/api/captures/'+b.id)).statusCode,200);noCopies(f.directory);
});

test('real HTTP disconnect during provider generation leaves no late body or central content and the original action can retry',async t=>{
 const f=await scopedMemoryFixture(t);await f.upload(f.a,'A');const hold=holdMemory(f);await f.node.app.listen({host:'127.0.0.1',port:0});const address=f.node.app.server.address();assert.ok(address&&typeof address!=='string');
 let bytes=0;const req=httpRequest({host:'127.0.0.1',port:address.port,path:'/api/export',headers:{authorization:'Bearer '+f.a.token,'x-mote-protocol-version':'2'}},response=>response.on('data',chunk=>{bytes+=chunk.length;}));const closed=new Promise<void>(resolve=>{req.on('error',()=>resolve());req.on('close',()=>resolve());});req.end();await hold.ready;req.destroy();await closed;hold.release();await delay(30);assert.equal(bytes,0);noCopies(f.directory);
 const retry=await f.request(f.a.token,'/api/export');assert.equal(retry.statusCode,200,retry.body);noCopies(f.directory);
});

test('erasure during a real backpressured full delivery fences later chunks and discards request content',async t=>{
 const f=await scopedFilesFixture(t),id=randomUUID(),bytes=Buffer.alloc(4*1024*1024,19);await f.checked(f.a.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'generated-large',items:[{id,deviceId:'same-device',deviceName:'Generated',platform:'import',capturedAt:new Date().toISOString(),durationMs:0,source:'screen',ocrText:'',imageBase64:bytes.toString('base64'),imageMime:'image/png',ocr:{status:'disabled'}}]});
 await f.host.app.listen({host:'127.0.0.1',port:0});const address=f.host.app.server.address();assert.ok(address&&typeof address!=='string');let received=0,total=0,removed=false;
 await new Promise<void>((resolve,reject)=>{const req=httpRequest({host:'127.0.0.1',port:address.port,path:'/api/export',headers:{authorization:'Bearer '+f.a.token,'x-mote-protocol-version':'2'}},response=>{total=Number(response.headers['content-length']);response.on('data',chunk=>{received+=chunk.length;if(!removed){removed=true;response.pause();void f.request(f.a.token,'/api/captures/'+id,'DELETE').then(result=>{assert.equal(result.statusCode,200,result.body);response.resume();},reject);}});response.on('error',()=>resolve());response.on('end',()=>resolve());response.on('close',()=>resolve());});req.on('error',reject);req.end();});
 assert.ok(removed);assert.ok(received<total,'remaining bytes must not be published after canonical erasure');noCopies(f.directory);assert.equal((await f.request(f.a.token,'/api/export')).statusCode,200);
});
