import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,writeFileSync,mkdtempSync,rmSync,cpSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {identityHash} from '../src/scope/originals.js';
import {captureBrowserRecord} from './fixtures/scoped-capture-host.js';
import {buildApp} from '../src/app.js';
import {backupScopedInstance,restoreScopedInstance,verifiedScopedBackup} from '../../../scripts/scoped-backup.mjs';

const root=(f:Awaited<ReturnType<typeof scopedFilesFixture>>,userId:string)=>join(f.directory,'originals',identityHash([f.host.deploymentId,userId]));
async function finished(f:Awaited<ReturnType<typeof scopedFilesFixture>>,token:string){
 const deadline=Date.now()+12000;while(Date.now()<deadline){const value=await f.checked(token,'/api/content-storage');if(!['running','queued'].includes(value.job.state))return value;await delay(25);}throw Error('Generated decrypt did not settle');
}

test('original storage controls use the real personal M04 policy, mixed M03 originals and physical owner statistics',async t=>{
 const f=await scopedFilesFixture(t),plain=await f.upload(f.a.token,'generated-plain','GENERATED_A_PLAIN');
 const b=await f.upload(f.b.token,'generated-b','GENERATED_B_PRIVATE_CONTENT');
 const beforeB=readFileSync(join(root(f,f.b.userId),'objects',b.original.hash,'0.plain'));
 const first=await f.request(f.a.token,'/api/content-storage');assert.equal(first.statusCode,200,first.body);
 const before=first.json();assert.equal(before.scope,'account');assert.equal(before.enabled,false);
 const enabled=await f.checked(f.a.token,'/api/content-storage','PUT',{enabled:true,revision:before.revision});assert.equal(enabled.enabled,true);
 const encrypted=await f.upload(f.a.token,'generated-encrypted','GENERATED_A_ENCRYPTED');
 const context=await f.host.authority.authenticate(f.a.token),device=f.host.accounts!.issueClient(context,f.host.authority,{serverUrl:'http://127.0.0.1:47832',label:'Generated storage collector',deviceId:'same-device',deviceName:'Generated collector',platform:'import',durationMs:0});assert.equal((await f.request(device.token,'/api/content-storage')).statusCode,403);assert.equal((await f.request(device.token,'/api/storage-statistics')).statusCode,403);
 const directory=join(root(f,f.a.userId),'objects',encrypted.original.hash),cipher=readFileSync(join(directory,'0.aes'));
 assert.equal(existsSync(join(directory,'0.plain')),false);assert.equal(cipher.includes(Buffer.from('GENERATED_A_ENCRYPTED')),false);
 const exportId=randomUUID();await f.checked(f.a.token,'/api/portable/exports','POST',{operationId:exportId});let receipt:any;for(let n=0;n<500;n++){receipt=await f.checked(f.a.token,'/api/portable/exports/'+exportId);if(receipt.state!=='working')break;await delay(10);}assert.equal(receipt.state,'completed',JSON.stringify(receipt));const archive=await f.checked(f.a.token,'/api/portable/exports/'+exportId+'/content');assert.equal(Buffer.from(archive.domains.find((domain:any)=>domain.domain==='ingress').payload.objects.find((row:any)=>row.hash===encrypted.original.hash).bytes,'base64').toString(),'GENERATED_A_ENCRYPTED');assert.ok(!JSON.stringify(archive).includes(readFileSync(join(root(f,f.a.userId),'content-key'),'utf8').trim()));
 assert.equal((await f.request(f.a.token,'/api/content-storage','PUT',{enabled:false,revision:before.revision})).statusCode,409);
 assert.equal((await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:randomUUID()})).statusCode,409);
 const report=await f.checked(f.a.token,'/api/storage-statistics');assert.equal(report.scope,'account');assert.ok(report.bytes>cipher.length);assert.equal(report.types.reduce((sum:number,row:any)=>sum+row.bytes,0),report.bytes);assert.equal(report.days.reduce((sum:number,row:any)=>sum+row.files,0),report.files);
 assert.equal(report.coverage.sharedDatabase,false);assert.ok(!JSON.stringify(report).includes('GENERATED_B'));
 await f.checked(f.a.token,'/api/content-storage','PUT',{enabled:false,revision:enabled.revision});
 assert.deepEqual(readFileSync(join(directory,'0.aes')),cipher,'disable must preserve retained ciphertext');
 await f.restart();
 const ref=encrypted.original.ref.slice(9),ticket=await f.checked(f.a.token,'/api/ingress/originals/'+ref+'/tickets','POST',{mode:'download'}),original=await f.request(f.a.token,'/api/ingress/originals/'+ref+'/content?ticket='+encodeURIComponent(ticket.ticket));assert.equal(original.statusCode,200,original.body);assert.equal(original.body,'GENERATED_A_ENCRYPTED');
 const id=randomUUID(),started=await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:id});assert.equal(started.statusCode,202,started.body);assert.ok(started.json().job.id);
 const same=await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:id});assert.equal(same.json().job.id,started.json().job.id);
 const result=await finished(f,f.a.token);assert.equal(result.job.state,'completed');assert.equal(result.job.failed,0);assert.equal(result.job.converted,1);assert.ok(result.job.skipped>=1);
 assert.equal(readFileSync(join(directory,'0.plain'),'utf8'),'GENERATED_A_ENCRYPTED');assert.equal(existsSync(join(directory,'0.aes')),false);
 assert.equal(readFileSync(join(root(f,f.a.userId),'objects',plain.original.hash,'0.plain'),'utf8'),'GENERATED_A_PLAIN');assert.deepEqual(readFileSync(join(root(f,f.b.userId),'objects',b.original.hash,'0.plain')),beforeB);
 assert.equal((await f.checked(f.b.token,'/api/content-storage')).job.state,'idle');
 assert.equal((await f.request(f.b.token,'/api/tasks/'+started.json().job.id)).statusCode,404);
 await f.restart();assert.equal((await f.checked(f.a.token,'/api/content-storage')).job.state,'completed');
});

test('account withdrawal during a real M03 physical workspace prevents further decryption without changing B',async t=>{
 const f=await scopedFilesFixture(t),view=await f.checked(f.a.token,'/api/content-storage'),enabled=await f.checked(f.a.token,'/api/content-storage','PUT',{enabled:true,revision:view.revision}),file=await f.upload(f.a.token,'generated-withdraw','GENERATED_WITHDRAWAL_CIPHERTEXT');await f.checked(f.a.token,'/api/content-storage','PUT',{enabled:false,revision:enabled.revision});
 const path=join(root(f,f.a.userId),'objects',file.original.hash,'0.aes'),cipher=readFileSync(path);let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>enter=r),gate=new Promise<void>(r=>release=r);t.after(()=>release());const context=await f.host.authority.authenticate(f.a.token),held=f.host.ingress.forUser(context).withWorkspace(async()=>{enter();await gate;}).then(()=>undefined,()=>undefined);await entered;
 const start=await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:randomUUID()});assert.equal(start.statusCode,202,start.body);await f.checked(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});release();await held;await delay(60);assert.deepEqual(readFileSync(path),cipher);assert.equal(existsSync(path.replace(/\.aes$/,'.plain')),false);assert.equal((await f.request(f.a.token,'/api/content-storage')).statusCode,401);assert.equal((await f.checked(f.b.token,'/api/content-storage')).job.state,'idle');assert.equal((await f.request(f.b.token,'/api/storage-statistics?userId='+f.a.userId)).statusCode,401);
});

test('decrypt cancellation, corrupt ciphertext, exact control and explicit retry retain originals and credentials',async t=>{
 const f=await scopedFilesFixture(t),settings=await f.checked(f.a.token,'/api/content-storage');
 const enabled=await f.checked(f.a.token,'/api/content-storage','PUT',{enabled:true,revision:settings.revision});
 const file=await f.upload(f.a.token,'generated-damage','GENERATED_RETAIN_ON_FAILURE'),path=join(root(f,f.a.userId),'objects',file.original.hash,'0.aes'),cipher=readFileSync(path);
 const key=readFileSync(join(root(f,f.a.userId),'content-key'));
 await f.checked(f.a.token,'/api/content-storage','PUT',{enabled:false,revision:enabled.revision});
 let entered!:()=>void,release!:()=>void;const ready=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);t.after(()=>release());const context=await f.host.authority.authenticate(f.a.token),physical=f.host.ingress.forUser(context).withWorkspace(async()=>{entered();await gate;});await ready;
 const start=await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:randomUUID()});assert.equal(start.statusCode,202,start.body);
 const busy=await f.checked(f.a.token,'/api/content-storage');assert.equal((await f.request(f.a.token,'/api/content-storage','PUT',{enabled:true,revision:busy.revision})).statusCode,409);assert.equal((await f.checked(f.a.token,'/api/content-storage')).enabled,false);
 assert.equal((await f.request(f.b.token,'/api/content-storage/decrypt/cancel','POST',{taskId:start.json().job.id})).statusCode,404);
 await f.checked(f.a.token,'/api/content-storage/decrypt/cancel','POST',{taskId:start.json().job.id});
 assert.equal((await f.checked(f.a.token,'/api/content-storage')).job.state,'cancelled');release();await physical;
 const damaged=Buffer.from(cipher);damaged[14]^=128;writeFileSync(path,damaged);
 await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:randomUUID()});const failed=await finished(f,f.a.token);assert.equal(failed.job.failed,1);assert.equal(failed.job.converted,0);assert.deepEqual(readFileSync(path),damaged);assert.deepEqual(readFileSync(join(root(f,f.a.userId),'content-key')),key);
 writeFileSync(path,cipher);await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:randomUUID()});const next=await finished(f,f.a.token);assert.equal(next.job.failed,0);assert.equal(next.job.converted,1);assert.equal(existsSync(path),false);
 assert.deepEqual(readFileSync(join(root(f,f.a.userId),'content-key')),key);assert.ok(readdirSync(root(f,f.a.userId)).every(name=>!name.includes('GENERATED')));
});

test('image and generic-import parts retain the same encrypted format, survive a write-policy change and never change B statistics',async t=>{
 const f=await scopedFilesFixture(t),initial=await f.checked(f.a.token,'/api/content-storage'),enabled=await f.checked(f.a.token,'/api/content-storage','PUT',{enabled:true,revision:initial.revision});
 const png=await sharp({create:{width:8,height:8,channels:3,background:'#123456'}}).png().toBuffer(),capture=captureBrowserRecord(123,'Generated storage image',{imageBase64:png.toString('base64'),imageMime:'image/png',ocrText:'',ocr:{status:'disabled'}});
 const received=await f.checked(f.a.token,'/api/ingress/sources/same-source/captures','POST',{batchId:randomUUID(),items:[capture]}),original=received.captures[0].original;
 assert.equal(existsSync(join(root(f,f.a.userId),'objects',original.hash,'0.aes')),true);
 const bytes=Buffer.from('GENERATED_PENDING_GENERIC_PART'),upload=await f.checked(f.a.token,'/api/import-uploads','POST',{name:'generated-import.txt',sizeBytes:bytes.length,mimeType:'text/plain'});
 await f.checked(f.a.token,'/api/import-uploads/'+upload.id+'/parts/0','PUT',bytes,{'content-type':'application/octet-stream'});
 await f.checked(f.a.token,'/api/content-storage','PUT',{enabled:false,revision:enabled.revision});await f.restart();
 const start=await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:randomUUID()});assert.equal(start.statusCode,202,start.body);const job=await finished(f,f.a.token);assert.equal(job.job.failed,0);assert.equal(job.job.converted,2);
 const committed=await f.checked(f.a.token,'/api/import-uploads/'+upload.id+'/commit','POST',{}),raw=await f.request(f.a.token,'/api/archived-files/'+committed.id+'/content');assert.equal(raw.statusCode,200,raw.body);assert.deepEqual(raw.rawPayload,bytes);
 const before=await f.checked(f.a.token,'/api/storage-statistics');await f.upload(f.b.token,'generated-b-extra','GENERATED_B_EXTRA'.repeat(200));const after=await f.checked(f.a.token,'/api/storage-statistics');assert.deepEqual({...after,generatedAt:null},{...before,generatedAt:null});
});

test('stopped instance backup validates and restores encrypted originals and rejects a missing original key before target publication',async t=>{
 const f=await scopedFilesFixture(t),workspace=mkdtempSync(join(tmpdir(),'mote-scoped-content-backup-'));t.after(()=>rmSync(workspace,{recursive:true,force:true}));
 const settings=await f.checked(f.a.token,'/api/content-storage');await f.checked(f.a.token,'/api/content-storage','PUT',{enabled:true,revision:settings.revision});const saved=await f.upload(f.a.token,'generated-backup','GENERATED_ENCRYPTED_BACKUP_ORIGINAL');
 await f.host.app.close();const snapshot=join(workspace,'snapshot'),target=join(workspace,'target');await backupScopedInstance({source:f.directory,out:snapshot});await verifiedScopedBackup(snapshot);await restoreScopedInstance({from:snapshot,target});
 const restored=await buildApp({dataDir:target});try{const login=await restored.accounts!.login('generated-a','Generated-joint-files-password','Generated backup client','client',0),context=await restored.authority.authenticate(login.token);assert.equal(restored.ingress.forUser(context).readOriginal(saved.original.ref).bytes.toString(),'GENERATED_ENCRYPTED_BACKUP_ORIGINAL');assert.equal((await restored.contentStorage!.view(context)).enabled,true);}finally{await restored.app.close();}
 const corrupt=join(workspace,'missing-key'),rejected=join(workspace,'rejected');cpSync(snapshot,corrupt,{recursive:true});const key='originals/'+identityHash([f.host.deploymentId,f.a.userId])+'/content-key';rmSync(join(corrupt,key));const manifest=JSON.parse(readFileSync(join(corrupt,'backup-manifest.json'),'utf8'));delete manifest.checksums[key];writeFileSync(join(corrupt,'backup-manifest.json'),JSON.stringify(manifest));await assert.rejects(restoreScopedInstance({from:corrupt,target:rejected}));assert.equal(existsSync(rejected),false);
});
