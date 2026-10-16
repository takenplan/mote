import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
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
 const bytes=Buffer.from('Generated exact recoverable text'),revision={sourceId:'same-source',previousRevision:null,item:{externalId:'same-file',revision:'r1',observedAt:'2026-10-15T00:00:00Z',title:'Generated file',text:'',kind:'file',layer:'snapshot',mimeType:'text/plain'},sizeBytes:bytes.length,sha256:bytesHash(bytes),relativePath:'generated.txt'};
 const send=async(token:string,upload:any)=>{if(!upload.receipt){await checked(token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:bytesHash(bytes)});return checked(token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{});}return upload.receipt;};
 const upload=async(token:string)=>send(token,await checked(token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'first',revision}));
 const wait=async(token:string,id:string)=>{for(let count=0;count<1000;count++){const task=await checked(token,'/api/tasks/'+id);if(['succeeded','blocked','failed','stale','cancelled'].includes(task.state))return task;await delay(10);}assert.fail('Generated task did not settle');};
 return {node,a,b,admin,bytes,revision,request,checked,send,upload,wait};
}

test('snapshot byte release preserves authorization metadata and published M06 extraction reads',async t=>{
 const f=await fixture(t),receipt=await f.upload(f.a.token),original=receipt.captures[0].original;
 const task=await f.checked(f.a.token,'/api/processing','POST',{originalRef:original.ref,operationId:'generated-extract'}),result=await f.wait(f.a.token,task.id);assert.equal(result.state,'succeeded',JSON.stringify(result));
 const context=await f.node.authority.authenticate(f.a.token);f.node.ingress.forUser(context).releaseSnapshot(original.ref);
 const status=await f.checked(f.a.token,'/api/processing/originals/'+original.ref.slice(9));assert.equal(status.processed,true);assert.equal(status.indexed,true);assert.equal(status.original.available,false);
 assert.equal((await f.checked(f.a.token,'/api/processing/artifacts/'+result.result.artifactId)).originalRef,original.ref);
 assert.equal((await f.checked(f.a.token,'/api/materials/'+status.materialId+'/read')).text,f.bytes.toString());
 assert.equal((await f.request(f.a.token,'/api/ingress/originals/'+original.ref.slice(9)+'/tickets','POST',{mode:'download'})).statusCode,410);
 assert.deepEqual((await f.checked(f.a.token,'/api/ingress/sources/same-source/recovery')).items,[]);
 assert.equal((await f.request(f.b.token,'/api/processing/originals/'+original.ref.slice(9))).statusCode,404);
});

test('expired unprocessed current snapshot recovers exact bytes through existing upload worker without adopting B',async t=>{
 const f=await fixture(t),ar=await f.upload(f.a.token),br=await f.upload(f.b.token),original=ar.captures[0].original;
 const now=Date.now();t.mock.method(Date,'now',()=>now+86400001);
 assert.equal((await f.request(f.a.token,'/api/ingress/originals/'+original.ref.slice(9)+'/tickets','POST',{mode:'download'})).statusCode,410);
 const task=await f.checked(f.a.token,'/api/processing','POST',{originalRef:original.ref,operationId:'generated-expired'}),blocked=await f.wait(f.a.token,task.id);assert.equal(blocked.state,'blocked',JSON.stringify(blocked));assert.equal(blocked.failure.code,'snapshot_input_expired');
 const needed=await f.checked(f.a.token,'/api/ingress/sources/same-source/recovery');assert.deepEqual(needed.items,[{captureId:ar.captures[0].id,externalId:'same-file',revision:'r1',sha256:f.revision.sha256,sizeBytes:f.bytes.length,observedAt:f.revision.item.observedAt}]);
 const path='/api/ingress/sources/same-source/recovery/'+ar.captures[0].id+'/uploads',value={batchId:'recover-exact',revision:{...f.revision,previousRevision:'r1'}};
 for(const revision of [{...value.revision,sha256:'0'.repeat(64)},{...value.revision,sizeBytes:1},{...value.revision,item:{...value.revision.item,observedAt:'2026-10-14T00:00:00Z'}}])assert.equal((await f.request(f.a.token,path,'POST',{...value,revision})).statusCode,409);
 const upload=await f.checked(f.a.token,path,'POST',value);assert.equal((await f.request(f.b.token,'/api/ingress/uploads/'+upload.id)).statusCode,404);
 const recovered=await f.send(f.a.token,upload);assert.equal(recovered.captures[0].original.ref,original.ref);assert.equal(recovered.captures[0].original.available,true);
 assert.equal((await f.checked(f.b.token,'/api/ingress/sources/same-source/originals')).items[0].ref,br.captures[0].original.ref);
 assert.equal((await f.checked(f.b.token,'/api/ingress/sources/same-source/originals')).items[0].available,false);
 await f.checked(f.a.token,'/api/tasks/'+task.id+'/retry','POST',{});const complete=await f.wait(f.a.token,task.id);assert.equal(complete.state,'succeeded',JSON.stringify(complete));assert.deepEqual((await f.checked(f.a.token,'/api/ingress/sources/same-source/recovery')).items,[]);
});
