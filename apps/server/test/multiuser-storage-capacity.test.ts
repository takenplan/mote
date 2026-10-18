import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {buildApp} from '../src/app.js';
import {bytesHash,identityHash} from '../src/scope/originals.js';

const headers={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const password='Generated-capacity-password-1';
const capture=(text='Generated capacity evidence',image?:Buffer)=>({id:randomUUID(),deviceId:'same-device',deviceName:'Generated device',platform:'import',capturedAt:new Date().toISOString(),durationMs:0,source:'screen',ocrText:text,...(image?{imageBase64:image.toString('base64'),imageMime:'image/png',ocr:{status:'disabled'}}:{})});
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-capacity-'));let host=await buildApp({dataDir:directory,maxStorageBytes:1024*1024});
 t.after(async()=>{await host.app.close();rmSync(directory,{recursive:true,force:true});});
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>host.app.inject({method,url,headers:{...headers,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 await host.accounts!.initialize('generated-admin',password);
 const login=async(username:string)=>{const result=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'});assert.equal(result.statusCode,200,result.body);return result.json();};
 const admin=await login('generated-admin'),owners=[];
 for(const username of ['generated-a','generated-b']){const created=await request(admin.token,'/api/admin/accounts','POST',{username,password});assert.equal(created.statusCode,200,created.body);const owner={...created.json(),...await login(username)};owners.push(owner);const source=await request(owner.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'snapshot'});assert.equal(source.statusCode,200,source.body);}
 const send=(token:string,input:any,batchId=randomUUID())=>request(token,'/api/ingress/sources/same-source/captures','POST',{batchId,items:[input]});
 const restart=async()=>{await host.app.close();host=await buildApp({dataDir:directory});await host.app.ready();};
 return {directory,get host(){return host;},request,admin,a:owners[0],b:owners[1],send,restart};
}

test('instance capacity rejects either owner at 507 atomically, admits duplicates, and resumes the same pending item after deletion/restart',async t=>{
 const f=await fixture(t),accepted:{owner:any;input:any;batchId:string}[]=[];let pending:any;
 for(let index=0;index<30;index++){
  const owner=index%2?f.b:f.a,input=capture('界'.repeat(30000)),batchId=randomUUID(),response=await f.send(owner.token,input,batchId);
  if(response.statusCode===507){assert.equal(response.json().error,'storage_limit');pending={owner,input,batchId};break;}
  assert.equal(response.statusCode,200,response.body);accepted.push({owner,input,batchId});
 }
 assert.ok(pending);assert.ok(accepted.some(row=>row.owner===f.a)&&accepted.some(row=>row.owner===f.b));
 assert.equal((await f.request(pending.owner.token,'/api/captures/'+pending.input.id)).statusCode,404);
 const other=pending.owner===f.a?f.b:f.a;assert.equal((await f.send(other.token,capture('界'.repeat(30000)))).statusCode,507,'one shared instance ceiling, no separate per-user allowance');
 const duplicate=accepted[0];assert.equal((await f.send(duplicate.owner.token,duplicate.input,duplicate.batchId)).statusCode,200,'durable ACK does not reserve payload twice');
 const removed=accepted.slice(0,3);for(const row of removed){const response=await f.request(row.owner.token,'/api/captures/'+row.input.id,'DELETE');assert.equal(response.statusCode,200,response.body);}
 await f.restart();const retry=await f.send(pending.owner.token,pending.input,pending.batchId);assert.equal(retry.statusCode,200,retry.body);assert.equal(retry.json().captures[0].duplicate,false);
 assert.equal((await f.request(other.token,'/api/captures/'+pending.input.id)).statusCode,404);
});

test('original and staging admission reject before writing bytes; existing per-owner hash deduplication stays available',async t=>{
 const f=await fixture(t),bytes=Buffer.alloc(200000,7),input=capture('',bytes),accepted=await f.send(f.a.token,input);assert.equal(accepted.statusCode,200,accepted.body);
 const second=await f.send(f.a.token,{...input,id:randomUUID()});assert.equal(second.statusCode,200,second.body);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());assert.equal(db.prepare('SELECT COUNT(*) n FROM ig_objects WHERE user_id=? AND hash=?').get(f.a.userId,bytesHash(bytes))!.n,1);
 const huge=Buffer.alloc(1024*1024,9),rejected=await f.send(f.b.token,capture('',huge));assert.equal(rejected.statusCode,507,rejected.body);
 const root=join(f.directory,'originals',identityHash([f.host.deploymentId,f.b.userId]),'objects',bytesHash(huge));assert.equal(existsSync(root),false);
 const upload=await f.request(f.b.token,'/api/import-uploads','POST',{name:'generated.bin',sizeBytes:huge.length,mimeType:'application/octet-stream'});assert.equal(upload.statusCode,200,upload.body);
 const part=await f.host.app.inject({method:'PUT',url:'/api/import-uploads/'+upload.json().id+'/parts/0',headers:{...headers,authorization:'Bearer '+f.b.token,'content-type':'application/octet-stream'},payload:huge});assert.equal(part.statusCode,507,part.body);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM ig_import_parts WHERE user_id=?').get(f.b.userId)!.n,0);
});

test('file and generic import promotion count staged bytes once, preserve resumability and owner hash isolation',async t=>{
 const f=await fixture(t),bytes=Buffer.alloc(600000,13),manifest={sourceId:'same-source',item:{externalId:'file',revision:'r1',observedAt:new Date().toISOString(),title:'Generated file',text:'',kind:'file',layer:'original',mimeType:'application/octet-stream'},sizeBytes:bytes.length,sha256:bytesHash(bytes),relativePath:'generated.bin'};
 const begin=await f.request(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'file',revision:manifest});assert.equal(begin.statusCode,200,begin.body);
 await f.restart();const resumed=await f.request(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'file',revision:manifest});assert.equal(resumed.json().id,begin.json().id);
 const part=await f.request(f.a.token,'/api/ingress/uploads/'+begin.json().id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:bytesHash(bytes)});assert.equal(part.statusCode,200,part.body);
 const commit=await f.request(f.a.token,'/api/ingress/uploads/'+begin.json().id+'/commit','POST',{});assert.equal(commit.statusCode,200,commit.body);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());assert.equal(db.prepare('SELECT COUNT(*) n FROM ig_upload_parts WHERE user_id=?').get(f.a.userId)!.n,0);
 // Same owned content does not reserve another 600KB, but B cannot borrow it.
 const again=await f.request(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'again',revision:{...manifest,item:{...manifest.item,externalId:'again'}}});assert.equal(again.statusCode,200,again.body);
 assert.equal((await f.request(f.a.token,'/api/ingress/uploads/'+again.json().id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:bytesHash(bytes)})).statusCode,200);
 assert.equal((await f.request(f.a.token,'/api/ingress/uploads/'+again.json().id+'/commit','POST',{})).statusCode,200);
 const b=await f.request(f.b.token,'/api/import-uploads','POST',{name:'other.bin',sizeBytes:bytes.length,mimeType:'application/octet-stream'});assert.equal(b.statusCode,200,b.body);
 const denied=await f.host.app.inject({method:'PUT',url:'/api/import-uploads/'+b.json().id+'/parts/0',headers:{...headers,authorization:'Bearer '+f.b.token,'content-type':'application/octet-stream'},payload:bytes});assert.equal(denied.statusCode,507,denied.body);
});

test('generic import transfers its verified unknown hash atomically and failed batches include all synchronous consumers before ACK',async t=>{
 const f=await fixture(t),bytes=Buffer.alloc(600000,17),begin=await f.request(f.a.token,'/api/import-uploads','POST',{name:'generated.bin',sizeBytes:bytes.length,mimeType:'application/octet-stream'});assert.equal(begin.statusCode,200,begin.body);
 const part=await f.host.app.inject({method:'PUT',url:'/api/import-uploads/'+begin.json().id+'/parts/0',headers:{...headers,authorization:'Bearer '+f.a.token,'content-type':'application/octet-stream'},payload:bytes});assert.equal(part.statusCode,200,part.body);
 const commit=await f.request(f.a.token,'/api/import-uploads/'+begin.json().id+'/commit','POST',{});assert.equal(commit.statusCode,200,commit.body);
 assert.equal((await f.request(f.a.token,'/api/archived-files/'+commit.json().id+'/content')).rawPayload.length,bytes.length);
 const items=Array.from({length:500},()=>capture('Generated')),response=await f.request(f.b.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'all-consumers',items});assert.equal(response.statusCode,507,response.body);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());assert.equal(db.prepare('SELECT COUNT(*) n FROM pd_captures WHERE user_id=?').get(f.b.userId)!.n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM mm_capture_intakes WHERE user_id=?').get(f.b.userId)!.n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM ig_batches WHERE user_id=?').get(f.b.userId)!.n,0);
});

test('administrator storage controls retain saved/effective restart policy and source revocation stays available above a lowered ceiling',async t=>{
 const f=await fixture(t),get=()=>f.request(f.admin.token,'/api/admin/storage-settings');
 assert.equal((await f.request(f.a.token,'/api/admin/storage-settings')).statusCode,403);
 const initial=(await get()).json(),larger=await f.request(f.admin.token,'/api/admin/storage-settings','PUT',{revision:initial.revision,retentionDays:0,maxStorageBytes:2*1024*1024});assert.equal(larger.statusCode,200,larger.body);assert.equal(larger.json().effective.maxStorageBytes,1024*1024);assert.equal(larger.json().status,'restart-required');await f.restart();
 for(let index=0;index<5;index++)assert.equal((await f.send(f.a.token,capture('界'.repeat(100000)))).statusCode,200);
 const current=(await get()).json(),lower=await f.request(f.admin.token,'/api/admin/storage-settings','PUT',{revision:current.revision,retentionDays:0,maxStorageBytes:1024*1024});assert.equal(lower.statusCode,200,lower.body);await f.restart();
 assert.equal((await f.send(f.a.token,capture('界'.repeat(30000)))).statusCode,507);
 const pause=await f.request(f.a.token,'/api/sources/same-source','PATCH',{enabled:false});assert.equal(pause.statusCode,200,pause.body);assert.equal(pause.json().enabled,false);
 const stale=await f.request(f.admin.token,'/api/admin/storage-settings','PUT',{revision:current.revision,retentionDays:7,maxStorageBytes:2*1024*1024});assert.equal(stale.statusCode,409);
});


test('snapshot GC frees its physical capacity while preserving unavailable original metadata and safely rehydrating the same owned hash',async t=>{
 const f=await fixture(t),bytes=Buffer.alloc(600000,23),first=await f.send(f.a.token,capture('',bytes));assert.equal(first.statusCode,200,first.body);const original=first.json().captures[0].original;
 const context=await f.host.authority.authenticate(f.a.token);f.host.ingress!.forUser(context).releaseSnapshot(original.ref);
 const gc=await f.request(f.a.token,'/api/ingress/gc','POST',{});assert.equal(gc.statusCode,200,gc.body);assert.ok(gc.json().removed>0);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());assert.equal(db.prepare('SELECT bytes FROM ig_objects WHERE user_id=? AND hash=?').get(f.a.userId,bytesHash(bytes))!.bytes,bytes.length);assert.equal(db.prepare('SELECT bytes FROM scoped_storage_evictions WHERE user_id=? AND hash=?').get(f.a.userId,bytesHash(bytes))!.bytes,bytes.length);
 const b=await f.send(f.b.token,capture('',Buffer.alloc(600000,29)));assert.equal(b.statusCode,200,b.body);assert.equal((await f.send(f.a.token,capture('',bytes))).statusCode,507,'evicted objects cannot claim resident deduplication credit');
 assert.equal((await f.request(f.b.token,'/api/captures/'+b.json().captures[0].id,'DELETE')).statusCode,200);assert.equal((await f.request(f.b.token,'/api/ingress/gc','POST',{})).statusCode,200);await f.restart();
 const rehydrated=await f.send(f.a.token,capture('',bytes));assert.equal(rehydrated.statusCode,200,rehydrated.body);assert.equal(db.prepare('SELECT COUNT(*) n FROM scoped_storage_evictions WHERE user_id=? AND hash=?').get(f.a.userId,bytesHash(bytes))!.n,0);
});


test('portable merge of an expired original retains its deadline and metadata without reserving absent physical bytes',async t=>{
 const f=await fixture(t),bytes=Buffer.alloc(600000,31),first=await f.send(f.a.token,capture('',bytes));assert.equal(first.statusCode,200,first.body);
 f.host.ingress!.forUser(await f.host.authority.authenticate(f.a.token)).releaseSnapshot(first.json().captures[0].original.ref);
 assert.equal((await f.request(f.a.token,'/api/ingress/gc','POST',{})).statusCode,200);
 const activity=new DatabaseSync(join(f.directory,'mote.sqlite'));try{let settled=false;for(let n=0;n<1000;n++){if(!activity.prepare("SELECT 1 FROM execution_steps WHERE state='running' OR(state='waiting' AND coalesce(error,'')<>'memory_window_pending') LIMIT 1").get()){settled=true;break;}await new Promise(resolve=>setTimeout(resolve,5));}assert.ok(settled,'generated input consumers must settle before the stable archive snapshot');}finally{activity.close();}
 const exported=await f.request(f.a.token,'/api/export');assert.equal(exported.statusCode,200,exported.body);const archive=exported.json();
 assert.equal((await f.request(f.a.token,'/api/sources/same-source','DELETE')).statusCode,200);assert.equal((await f.request(f.a.token,'/api/ingress/gc','POST',{})).statusCode,200);
 assert.equal((await f.send(f.b.token,capture('',Buffer.alloc(600000,37)))).statusCode,200);
 const id=randomUUID(),started=await f.request(f.a.token,'/api/portable/imports','POST',{operationId:id,archive});assert.equal(started.statusCode,200,started.body);let receipt=started.json();for(let n=0;receipt.state==='working'&&n<100;n++){await new Promise(resolve=>setTimeout(resolve,10));receipt=(await f.request(f.a.token,'/api/portable/imports/'+id)).json();}assert.equal(receipt.state,'completed',JSON.stringify(receipt));
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{assert.equal(db.prepare('SELECT bytes FROM scoped_storage_evictions WHERE user_id=? AND hash=?').get(f.a.userId,bytesHash(bytes))!.bytes,bytes.length);assert.equal(db.prepare('SELECT expires FROM ig_snapshot_inputs WHERE user_id=?').get(f.a.userId)!.expires,0);}finally{db.close();}
});
