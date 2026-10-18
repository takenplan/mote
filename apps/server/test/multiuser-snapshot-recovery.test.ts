import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {buildApp} from '../src/app.js';
import {bytesHash} from '../src/scope/originals.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';

async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m14-snapshot-')),node=await buildApp({dataDir:directory});t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 const password='Generated-snapshot-only-01',headers={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({url,method,headers:{...headers,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const checked=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const response=await request(token,url,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 await node.accounts!.initialize('generated-admin',password);const login=(username:string)=>checked(undefined,'/api/auth/login','POST',{username,password,mode:'client'}),admin=await login('generated-admin');
 for(const username of ['generated-a','generated-b'])await checked(admin.token,'/api/admin/accounts','POST',{username,password});
 const a=await login('generated-a'),b=await login('generated-b');
 for(const grant of [a,b]){const view=await checked(grant.token,'/api/configuration');await checked(grant.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),automatic:false,summarize:false,understandingEnabled:false}});await checked(grant.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated snapshot source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'snapshot'});}
 const bytes=Buffer.from('Generated exact recoverable text'),revision={sourceId:'same-source',previousRevision:null,item:{externalId:'same-file',revision:'r1',observedAt:'2026-10-15T00:00:00Z',title:'Generated file',text:'',kind:'file',layer:'snapshot',mimeType:'text/plain',document:{fileIndex:{version:1,fileId:'same-file',contentVersion:bytesHash(bytes),mode:'index',coverage:'none',parser:'central-pending',status:'pending',totalCharacters:0,offset:0,length:0,maxIndexCharacters:8000,allowRead:false}}},sizeBytes:bytes.length,sha256:bytesHash(bytes),relativePath:'generated.txt'};
 const send=async(token:string,upload:any)=>{if(!upload.receipt){await checked(token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:bytesHash(bytes)});return checked(token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{});}return upload.receipt;};
 const upload=async(token:string)=>send(token,await checked(token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'first',revision}));
 const wait=async(token:string,id:string)=>{for(let count=0;count<1000;count++){const task=await checked(token,'/api/tasks/'+id);if(['succeeded','blocked','failed','stale','cancelled'].includes(task.state))return task;await delay(10);}assert.fail('Generated task did not settle');};
 const expire=()=>{const db=new DatabaseSync(join(directory,'mote.sqlite'));try{const inputs=db.prepare('SELECT expires FROM ig_snapshot_inputs').all();assert.ok(inputs.length);assert.ok(inputs.every(row=>Number(row.expires)>Date.now()&&Number(row.expires)<=Date.now()+86400000));db.prepare('UPDATE ig_snapshot_inputs SET expires=?').run(Date.now()-1);}finally{db.close();}};
 return {directory,node,a,b,admin,bytes,revision,request,checked,send,upload,wait,expire};
}

test('snapshot byte release preserves authorization metadata and published M06 extraction reads',async t=>{
 const f=await fixture(t),receipt=await f.upload(f.a.token),original=receipt.captures[0].original;
 const task=await f.checked(f.a.token,'/api/processing','POST',{originalRef:original.ref,operationId:'generated-extract'}),result=await f.wait(f.a.token,task.id);assert.equal(result.state,'succeeded',JSON.stringify(result));
 const context=await f.node.authority.authenticate(f.a.token);f.node.ingress.forUser(context).releaseSnapshot(original.ref);
 const status=await f.checked(f.a.token,'/api/processing/originals/'+original.ref.slice(9));assert.equal(status.processed,true);assert.equal(status.indexed,true);assert.equal(status.original.available,false);
 assert.equal((await f.checked(f.a.token,'/api/processing/artifacts/'+result.result.artifactId)).originalRef,original.ref);
 assert.equal((await f.checked(f.a.token,'/api/materials/'+status.materialId+'/read')).text,f.bytes.toString());
 await f.checked(f.a.token,'/api/ingress/gc','POST',{});assert.equal((await f.checked(f.a.token,'/api/processing/artifacts/'+result.result.artifactId)).originalRef,original.ref);
 const archive=await f.node.services.forUser(context).exportUser('ingress'),payload=archive.payload as any;assert.equal(payload.originals.length,1);assert.equal(payload.objects.length,0);assert.deepEqual(payload.snapshots,[{id:original.ref.slice(9),expires:0,bytes:f.bytes.length}]);
 assert.equal((await f.request(f.a.token,'/api/ingress/originals/'+original.ref.slice(9)+'/tickets','POST',{mode:'download'})).statusCode,410);
 assert.deepEqual((await f.checked(f.a.token,'/api/ingress/sources/same-source/recovery')).items,[]);
 assert.equal((await f.request(f.b.token,'/api/processing/originals/'+original.ref.slice(9))).statusCode,404);
});

test('expired unprocessed current snapshot recovers exact bytes through existing upload worker without adopting B',async t=>{
 const f=await fixture(t),ar=await f.upload(f.a.token),br=await f.upload(f.b.token),original=ar.captures[0].original;
 f.expire();
 assert.equal((await f.request(f.a.token,'/api/ingress/originals/'+original.ref.slice(9)+'/tickets','POST',{mode:'download'})).statusCode,410);
 const task=await f.checked(f.a.token,'/api/processing','POST',{originalRef:original.ref,operationId:'generated-expired'}),blocked=await f.wait(f.a.token,task.id);assert.equal(blocked.state,'blocked',JSON.stringify(blocked));assert.equal(blocked.failure.code,'snapshot_input_expired');
 const journal=new DatabaseSync(join(f.directory,'mote.sqlite'));try{assert.equal(journal.prepare('SELECT count(*) n FROM task_external_calls WHERE user_id=?').get(f.a.userId)!.n,0,'expired local bytes must not record an issued external call');}finally{journal.close();}
 await f.checked(f.a.token,'/api/ingress/gc','POST',{});
 const needed=await f.checked(f.a.token,'/api/ingress/sources/same-source/recovery');assert.equal(needed.items.length,1);assert.match(needed.items[0].recoveryId,/^[a-f0-9]{64}$/);assert.deepEqual(needed.items,[{captureId:ar.captures[0].id,externalId:'same-file',revision:'r1',sha256:f.revision.sha256,sizeBytes:f.bytes.length,observedAt:new Date(f.revision.item.observedAt).toISOString(),recoveryId:needed.items[0].recoveryId}]);
 const path='/api/ingress/sources/same-source/recovery/'+ar.captures[0].id+'/uploads',value={batchId:'recover-exact',revision:{...f.revision,previousRevision:'r1'},recoveryId:needed.items[0].recoveryId};
 for(const revision of [{...value.revision,sha256:'0'.repeat(64),item:{...value.revision.item,document:{fileIndex:{...value.revision.item.document.fileIndex,contentVersion:'0'.repeat(64)}}}},{...value.revision,sizeBytes:1},{...value.revision,item:{...value.revision.item,observedAt:'2026-10-14T00:00:00Z'}}])assert.equal((await f.request(f.a.token,path,'POST',{...value,revision})).statusCode,409);
 const upload=await f.checked(f.a.token,path,'POST',value);assert.equal((await f.request(f.b.token,'/api/ingress/uploads/'+upload.id)).statusCode,404);
 const recovered=await f.send(f.a.token,upload);assert.equal(recovered.captures[0].original.ref,original.ref);assert.equal(recovered.captures[0].original.available,true);
 assert.equal((await f.checked(f.a.token,path,'POST',value)).id,upload.id,'lost recovery ACK reuses the exact session');assert.equal((await f.request(f.a.token,path,'POST',{...value,recoveryId:'0'.repeat(64)})).statusCode,409);
 assert.equal((await f.checked(f.b.token,'/api/ingress/sources/same-source/originals')).items[0].ref,br.captures[0].original.ref);
 assert.equal((await f.checked(f.b.token,'/api/ingress/sources/same-source/originals')).items[0].available,false);
 const complete=await f.wait(f.a.token,task.id);assert.equal(complete.state,'succeeded',JSON.stringify(complete));assert.deepEqual((await f.checked(f.a.token,'/api/ingress/sources/same-source/recovery')).items,[]);
});

test('ordinary expired ACK replay preserves the original snapshot deadline and never renews an expired recovery upload',async t=>{
 const f=await fixture(t),received=await f.upload(f.a.token),original=received.captures[0].original;
 f.expire();const db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());const deadline=db.prepare('SELECT expires FROM ig_snapshot_inputs WHERE user_id=? AND original_id=?').get(f.a.userId,original.ref.slice(9))!.expires,expired=Date.now()-25*3600000;
 db.prepare('UPDATE ig_uploads SET expires=? WHERE user_id=?').run(expired,f.a.userId);
 const replay=await f.checked(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'first',revision:f.revision});assert.equal(replay.receipt.captures[0].id,received.captures[0].id);assert.equal(replay.receipt.captures[0].original.available,false,'durable ACK replay reports current byte availability');assert.equal(db.prepare('SELECT expires FROM ig_snapshot_inputs WHERE user_id=? AND original_id=?').get(f.a.userId,original.ref.slice(9))!.expires,deadline,'reception is not snapshot recovery authority');
 const task=await f.checked(f.a.token,'/api/processing','POST',{originalRef:original.ref,operationId:'generated-expired-recovery-session'});assert.equal((await f.wait(f.a.token,task.id)).state,'blocked');
 const needed=await f.checked(f.a.token,'/api/ingress/sources/same-source/recovery'),path='/api/ingress/sources/same-source/recovery/'+received.captures[0].id+'/uploads',value={batchId:'expired-recovery',revision:{...f.revision,previousRevision:'r1'},recoveryId:needed.items[0].recoveryId},upload=await f.checked(f.a.token,path,'POST',value);
 await f.checked(f.a.token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:f.bytes.toString('base64'),checksum:bytesHash(f.bytes)});db.prepare('UPDATE ig_uploads SET expires=? WHERE user_id=? AND id=?').run(expired,f.a.userId,upload.id);
 assert.equal((await f.request(f.a.token,path,'POST',value)).statusCode,409,'recovery retry cannot renew its expired grant');assert.equal((await f.request(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:value.batchId,revision:value.revision})).statusCode,409,'ordinary begin cannot bypass the recovery grant');assert.equal((await f.request(f.a.token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{})).statusCode,409);assert.equal(db.prepare('SELECT expires FROM ig_uploads WHERE user_id=? AND id=?').get(f.a.userId,upload.id)!.expires,expired);assert.equal(db.prepare('SELECT expires FROM ig_snapshot_inputs WHERE user_id=? AND original_id=?').get(f.a.userId,original.ref.slice(9))!.expires,deadline);assert.equal((await f.checked(f.a.token,'/api/captures')).items.length,1);
});

test('an exact original pin protects expired processing bytes without granting a download or changing ordinary capture retention',async t=>{
 const f=await fixture(t),receipt=await f.upload(f.a.token),original=receipt.captures[0].original,context=await f.node.authority.authenticate(f.a.token),service=f.node.ingress.forUser(context),release=service.holdOriginal(original.ref);
 const id='00000000-0000-4000-8000-000000000014',capture=await f.checked(f.a.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'ordinary-capture',items:[{id,deviceId:'same-device',deviceName:'Generated',platform:'import',capturedAt:'2026-10-15T00:00:00Z',durationMs:0,source:'screen',ocrText:'',imageMime:'image/png',imageBase64:Buffer.from('Generated ordinary capture').toString('base64')}]});
 f.expire();await f.checked(f.a.token,'/api/ingress/gc','POST',{});assert.deepEqual(service.readOriginal(original.ref).bytes,f.bytes);assert.equal(service.readOriginal(original.ref,{length:0}).available,false);
 assert.equal((await f.request(f.a.token,'/api/ingress/originals/'+original.ref.slice(9)+'/tickets','POST',{mode:'download'})).statusCode,410);
 release();await f.checked(f.a.token,'/api/ingress/gc','POST',{});assert.throws(()=>service.readOriginal(original.ref),{code:'snapshot_input_expired'});assert.equal(service.readOriginal(original.ref,{length:0}).totalBytes,f.bytes.length);
 assert.equal(service.readOriginal(capture.captures[0].original.ref,{length:0}).available,true);
 assert.deepEqual((await f.checked(f.a.token,'/api/ingress/sources/same-source/recovery')).items,[],'without a waiting extraction there is no automatic recovery request');
});
