import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {identityHash} from '../src/scope/originals.js';

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
 const directory=join(root(f,f.a.userId),'objects',encrypted.original.hash),cipher=readFileSync(join(directory,'0.aes'));
 assert.equal(existsSync(join(directory,'0.plain')),false);assert.equal(cipher.includes(Buffer.from('GENERATED_A_ENCRYPTED')),false);
 assert.equal((await f.request(f.a.token,'/api/content-storage','PUT',{enabled:false,revision:before.revision})).statusCode,409);
 assert.equal((await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:randomUUID()})).statusCode,409);
 const report=await f.checked(f.a.token,'/api/storage-statistics');assert.equal(report.scope,'account');assert.ok(report.bytes>cipher.length);assert.equal(report.types.reduce((sum:number,row:any)=>sum+row.bytes,0),report.bytes);assert.equal(report.days.reduce((sum:number,row:any)=>sum+row.files,0),report.files);
 assert.equal(report.coverage.sharedDatabase,false);assert.ok(!JSON.stringify(report).includes('GENERATED_B'));
 await f.checked(f.a.token,'/api/content-storage','PUT',{enabled:false,revision:enabled.revision});
 assert.deepEqual(readFileSync(join(directory,'0.aes')),cipher,'disable must preserve retained ciphertext');
 await f.restart();
 const original=await f.checked(f.a.token,'/api/ingress/originals/'+encrypted.original.ref.slice(9));assert.equal(Buffer.from(original.bytes,'base64').toString(),'GENERATED_A_ENCRYPTED');
 const id=randomUUID(),started=await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:id});assert.equal(started.statusCode,202,started.body);assert.ok(started.json().job.id);
 const same=await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:id});assert.equal(same.json().job.id,started.json().job.id);
 const result=await finished(f,f.a.token);assert.equal(result.job.state,'completed');assert.equal(result.job.failed,0);assert.equal(result.job.converted,1);assert.ok(result.job.skipped>=1);
 assert.equal(readFileSync(join(directory,'0.plain'),'utf8'),'GENERATED_A_ENCRYPTED');assert.equal(existsSync(join(directory,'0.aes')),false);
 assert.equal(readFileSync(join(root(f,f.a.userId),'objects',plain.original.hash,'0.plain'),'utf8'),'GENERATED_A_PLAIN');assert.deepEqual(readFileSync(join(root(f,f.b.userId),'objects',b.original.hash,'0.plain')),beforeB);
 assert.equal((await f.checked(f.b.token,'/api/content-storage')).job.state,'idle');
 assert.equal((await f.request(f.b.token,'/api/tasks/'+started.json().job.id)).statusCode,404);
 await f.restart();assert.equal((await f.checked(f.a.token,'/api/content-storage')).job.state,'completed');
});

test('decrypt cancellation, corrupt ciphertext, exact control and explicit retry retain originals and credentials',async t=>{
 const f=await scopedFilesFixture(t),settings=await f.checked(f.a.token,'/api/content-storage');
 const enabled=await f.checked(f.a.token,'/api/content-storage','PUT',{enabled:true,revision:settings.revision});
 const file=await f.upload(f.a.token,'generated-damage','GENERATED_RETAIN_ON_FAILURE'),path=join(root(f,f.a.userId),'objects',file.original.hash,'0.aes'),cipher=readFileSync(path);
 const key=readFileSync(join(root(f,f.a.userId),'content-key'));
 await f.checked(f.a.token,'/api/content-storage','PUT',{enabled:false,revision:enabled.revision});
 const start=await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:randomUUID()});assert.equal(start.statusCode,202,start.body);
 assert.equal((await f.request(f.b.token,'/api/content-storage/decrypt/cancel','POST',{taskId:start.json().job.id})).statusCode,404);
 await f.checked(f.a.token,'/api/content-storage/decrypt/cancel','POST',{taskId:start.json().job.id});
 assert.equal((await f.checked(f.a.token,'/api/content-storage')).job.state,'cancelled');
 const damaged=Buffer.from(cipher);damaged[14]^=128;writeFileSync(path,damaged);
 await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:randomUUID()});const failed=await finished(f,f.a.token);assert.equal(failed.job.failed,1);assert.equal(failed.job.converted,0);assert.deepEqual(readFileSync(path),damaged);assert.deepEqual(readFileSync(join(root(f,f.a.userId),'content-key')),key);
 writeFileSync(path,cipher);await f.request(f.a.token,'/api/content-storage/decrypt','POST',{operationId:randomUUID()});const next=await finished(f,f.a.token);assert.equal(next.job.failed,0);assert.equal(next.job.converted,1);assert.equal(existsSync(path),false);
 assert.deepEqual(readFileSync(join(root(f,f.a.userId),'content-key')),key);assert.ok(readdirSync(root(f,f.a.userId)).every(name=>!name.includes('GENERATED')));
});
