import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';

async function selected(f:Awaited<ReturnType<typeof scopedMemoryFixture>>,user:any,label:string){
 const material=await f.publish(user,label),job=await f.submit(user,[material.id]);await f.wait(user,job.id);
 const memory=(await f.request(user.token,'/api/memories')).json().items[0];assert.ok(memory&&memory.status==='published');
 return {memory,pin:{id:memory.id,version:memory.version,fingerprint:memory.fingerprint}};
}

test('original manual integration pins the selected Memory and recipe in the existing owned M07 job without enabling automatic work',async t=>{
 const f=await scopedMemoryFixture(t),a=await selected(f,f.a,'A'),b=await selected(f,f.b,'B'),recipes=(await f.request(f.a.token,'/api/memory/recipes')).json().integrations,recipe=recipes.find((item:any)=>item.available);assert.ok(recipe);
 const before=(await f.request(f.a.token,'/api/configuration')).json(),input={operationId:randomUUID(),recipe:{id:recipe.id,version:recipe.version},inputs:[a.pin]},response=await f.request(f.a.token,'/api/memory-integrations','POST',input);
 assert.equal(response.statusCode,200,response.body);const job=await f.wait(f.a,input.operationId);assert.equal(job.id,input.operationId);
 const saved=f.read(db=>JSON.parse(String(db.prepare('SELECT input FROM mm_jobs WHERE user_id=? AND id=?').get(f.a.userId,input.operationId)!.input)));
 assert.equal(saved.phase,'integrate');assert.equal(saved.automatic,false);assert.deepEqual(saved.related,[a.pin]);assert.deepEqual(saved.integration.recipe,{...recipe.binding.recipe});
 assert.deepEqual((await f.request(f.a.token,'/api/configuration')).json(),before,'manual recipe never changes global/default settings');
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1,'zero newly consolidated memories is an honest successful result');
 const count=f.requests.length;assert.equal((await f.request(f.a.token,'/api/memory-integrations','POST',input)).statusCode,200);assert.equal(f.requests.length,count,'same operation has no second provider execution');
 assert.equal((await f.request(f.b.token,'/api/memory-integrations','POST',{...input,operationId:randomUUID()})).statusCode,404);
 assert.equal((await f.request(f.a.token,'/api/memory-integrations','POST',{...input,operationId:randomUUID(),inputs:[{...a.pin,fingerprint:'f'.repeat(64)}]})).statusCode,409);
 assert.equal((await f.request(f.a.token,'/api/memory-integrations','POST',{...input,operationId:randomUUID(),recipe:{...input.recipe,version:'999.0.0'}})).statusCode,409);
 const positive=await f.request(f.b.token,'/api/memory-integrations','POST',{...input,operationId:randomUUID(),inputs:[b.pin]});assert.equal(positive.statusCode,200,positive.body);await f.wait(f.b,positive.json().id);
 assert.ok(f.requests.every(call=>!call.raw.includes('GENERATED_MEMORY_A')||call.key==='GENERATED_A_KEY'));
});

test('a retired selected Memory version cannot be silently substituted during manual integration admission',async t=>{
 const f=await scopedMemoryFixture(t),a=await selected(f,f.a,'A'),recipe=(await f.request(f.a.token,'/api/memory/recipes')).json().integrations.find((item:any)=>item.available),changed=await f.request(f.a.token,'/api/memories/'+a.pin.id+'/correct','POST',{operationId:randomUUID(),correction:{version:a.pin.version,title:'Generated corrected A',statement:'Generated owner correction retained as new evidence.'}});assert.equal(changed.statusCode,200,changed.body);
 const count=f.requests.length,response=await f.request(f.a.token,'/api/memory-integrations','POST',{operationId:randomUUID(),recipe:{id:recipe.id,version:recipe.version},inputs:[a.pin]});assert.equal(response.statusCode,409,response.body);assert.equal(f.requests.length,count,'no new provider work is admitted for the old selection');
});
