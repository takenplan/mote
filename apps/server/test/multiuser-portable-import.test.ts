import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';

async function archive(f:Awaited<ReturnType<typeof scopedMemoryFixture>>){
 const id=randomUUID(),started=await f.request(f.a.token,'/api/portable/exports','POST',{operationId:id});assert.equal(started.statusCode,200,started.body);
 for(let attempt=0;attempt<300;attempt++){const response=await f.request(f.a.token,'/api/portable/exports/'+id);assert.equal(response.statusCode,200,response.body);const receipt=response.json();if(receipt.state==='completed'){const content=await f.request(f.a.token,'/api/portable/exports/'+id+'/content');assert.equal(content.statusCode,200,content.body);return content.json();}assert.equal(receipt.state,'working',JSON.stringify(receipt));await delay(10);}assert.fail('Generated export did not settle');
}
async function imported(f:Awaited<ReturnType<typeof scopedMemoryFixture>>,value:unknown,id=randomUUID()){
 const started=await f.request(f.a.token,'/api/portable/imports','POST',{operationId:id,archive:value});assert.equal(started.statusCode,200,started.body);
 let receipt=started.json();for(let attempt=0;receipt.state==='working'&&attempt<300;attempt++){await delay(10);const response=await f.request(f.a.token,'/api/portable/imports/'+id);assert.equal(response.statusCode,200,response.body);receipt=response.json();}return receipt;
}
test('original-account portable import merges missing original data, keeps existing records and deduplicates after a real host restart',async t=>{
 const f=await scopedMemoryFixture(t),a=await f.upload(f.a,'A','archive-original'),b=await f.upload(f.b,'B','archive-original'),saved=await archive(f),captureId=a.captures[0].id;
 assert.equal(saved.userId,f.a.userId);const operationId=randomUUID();
 assert.equal((await f.request(f.a.token,'/api/captures/'+captureId,'DELETE')).statusCode,200);
 const current=await f.upload(f.a,'A','keep-current',Buffer.from('Generated current A record'));
 const beforeB=f.read(db=>({captures:db.prepare('SELECT * FROM pd_captures WHERE user_id=? ORDER BY id').all(f.b.userId),credentials:db.prepare('SELECT * FROM auth_credentials WHERE user_id=? ORDER BY id').all(f.b.userId)})),calls=f.requests.length,grants=f.read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all());
 const receipt=await imported(f,saved,operationId);assert.equal(receipt.state,'completed',JSON.stringify(receipt));assert.equal(receipt.kind,'import');assert.equal(receipt.userId,f.a.userId);assert.equal(receipt.deploymentId,f.node.deploymentId);assert.equal(receipt.progress.mode,'semantic');assert.equal(receipt.coverage.credentials,false);assert.equal(receipt.coverage.activeAuthorization,false);
 const own=await f.request(f.a.token,'/api/captures/'+captureId);assert.equal(own.statusCode,200,own.body);assert.equal((await f.request(f.a.token,'/api/captures/'+current.captures[0].id)).statusCode,200);
 const context=await f.node.authority.authenticate(f.a.token);assert.deepEqual(f.node.ingress.forUser(context).readOriginal(a.captures[0].original.ref).bytes,Buffer.from('GENERATED_MEMORY_A: Nora prefers generated tea.'));
 assert.equal((await f.request(f.b.token,'/api/portable/imports/'+operationId)).statusCode,404);assert.equal((await f.request(f.admin.token,'/api/portable/imports/'+operationId)).statusCode,404);
 assert.equal((await f.request(f.b.token,'/api/captures/'+b.captures[0].id)).statusCode,200);assert.deepEqual(f.read(db=>({captures:db.prepare('SELECT * FROM pd_captures WHERE user_id=? ORDER BY id').all(f.b.userId),credentials:db.prepare('SELECT * FROM auth_credentials WHERE user_id=? ORDER BY id').all(f.b.userId)})),beforeB);
 assert.deepEqual(f.read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all()),grants);assert.equal(f.requests.length,calls);
 assert.deepEqual(await imported(f,saved,operationId),receipt);await f.restart();assert.deepEqual((await f.request(f.a.token,'/api/portable/imports/'+operationId)).json(),receipt);assert.deepEqual(await imported(f,saved,operationId),receipt);
 const duplicate=await imported(f,saved);assert.equal(duplicate.state,'completed',JSON.stringify(duplicate));assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM pd_captures WHERE user_id=? AND id=?').get(f.a.userId,captureId)!.n),1);
});
test('portable import rejects a foreign account, deployment, old version and incomplete coverage before admitting data',async t=>{
 const f=await scopedMemoryFixture(t);await f.upload(f.a,'A');const saved=await archive(f),before=f.read(db=>db.prepare('SELECT * FROM pd_captures ORDER BY user_id,id').all());
 for(const value of [{...saved,userId:f.b.userId},{...saved,deploymentId:randomUUID()},{...saved,version:2},{...saved,domains:saved.domains.slice(1)}]){const response=await f.request(f.a.token,'/api/portable/imports','POST',{operationId:randomUUID(),archive:value});assert.ok([400,403,409].includes(response.statusCode),response.body);assert.deepEqual(f.read(db=>db.prepare('SELECT * FROM pd_captures ORDER BY user_id,id').all()),before);}
});
test('a later invalid canonical domain rolls back earlier captures, original files and grants rather than publishing a partial import',async t=>{
 const f=await scopedMemoryFixture(t),captured=await f.upload(f.a,'A'),saved=await archive(f),captureId=captured.captures[0].id;
 assert.equal((await f.request(f.a.token,'/api/captures/'+captureId,'DELETE')).statusCode,200);assert.equal((await f.request(f.a.token,'/api/ingress/gc','POST',{})).statusCode,200);
 const beforeFiles=readdirSync(join(f.directory,'originals'),{recursive:true}).filter(name=>String(name).endsWith('.plain')).sort(),grants=f.read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all());
 const broken=structuredClone(saved);broken.domains.find((domain:any)=>domain.domain==='processing').payload.artifacts.push({id:'0'.repeat(64),original_id:'1'.repeat(64),fingerprint:'2'.repeat(64),json:'{}',complete:1});
 const receipt=await imported(f,broken);assert.equal(receipt.state,'failed',JSON.stringify(receipt));assert.equal((await f.request(f.a.token,'/api/captures/'+captureId)).statusCode,404);
 assert.deepEqual(readdirSync(join(f.directory,'originals'),{recursive:true}).filter(name=>String(name).endsWith('.plain')).sort(),beforeFiles);assert.deepEqual(f.read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all()),grants);
});
