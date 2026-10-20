import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {materialId} from '../src/materials.js';
import {memoryFixture,memoryText} from './fixtures/mcp-memory.js';
import {source,item,call,value} from './fixtures/mcp.js';

test('MCP Memory scopes bind transitive candidates and cursors before LIMIT, map empty read scopes to all, and survive restart',async t=>{
 const f=await memoryFixture(t),first=await f.publish(f.a,'A','same-source','first'),second=await f.publish(f.a,'A','same-source','second'),hidden=await f.publish(f.a,'A','other-source','hidden');for(const material of [first,second,hidden])await f.extract(f.a,material.id);const bm=await f.publish(f.b,'B');await f.extract(f.b,bm.id);
 const context=await f.node.authority.authenticate(f.a.token),bound=f.node.ingress.bindSource(context,['same-source','other-source'],()=>{}),mixed=bound.publishMaterial({id:materialId('same-source','mixed'),kind:'document',schemaVersion:1,title:'Generated mixed-source Material',origin:{sourceId:'same-source',externalId:'mixed'},blocks:[{id:'same-block',kind:'text',format:'plain',text:memoryText('A'),memberIds:['a','h']}],members:[{id:'a',kind:'material',ref:first.ref},{id:'h',kind:'material',ref:hidden.ref}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});await f.extract(f.a,mixed.id);
 const grant=await f.mint(f.a.token),a=await f.connect(grant),all=await f.connect(await f.mint(f.a.token,'read',[])),b=await f.connect(await f.mint(f.b.token)),narrow=value(await call(a.client,'mote_memories',{limit:1})),broad=value(await call(all.client,'mote_memories',{limit:1}));assert.ok(narrow.nextCursor);assert.ok(broad.nextCursor);assert.equal(value(await call(all.client,'mote_memories')).items.length,4);assert.equal(value(await call(a.client,'mote_memories')).items.length,2);assert.equal(value(await call(all.client,'mote_memories',{sourceId:'same-source'})).items.length,2);assert.equal((await call(a.client,'mote_memories',{sourceId:'other-source'})).isError,true);
 assert.equal((await call(a.client,'mote_memories',{limit:1,cursor:broad.nextCursor})).isError,true);assert.equal((await call(b.client,'mote_memories',{limit:1,cursor:narrow.nextCursor})).isError,true);await assert.rejects(call(a.client,'mote_memories',{userId:f.b.userId}));assert.equal(JSON.parse((await a.client.readResource({uri:'mote://memories'})).contents[0].text as string).items.length,2);
 await f.restart();const resumed=await f.connect(grant),page=value(await call(resumed.client,'mote_memories',{limit:1,cursor:narrow.nextCursor}));assert.equal(page.items.length,1);assert.notEqual(page.items[0].id,narrow.items[0].id);assert.doesNotMatch(JSON.stringify(page),/Generated B/);
});

test('MCP exact historical Memory read remains provider-backed and is fenced by current Memory and original pins',async t=>{
 const f=await memoryFixture(t,true),material=await f.publish(f.a,'A');await f.extract(f.a,material.id);await f.externalize([f.a]);const original=(await f.ok(f.a.token,'/api/memories')).items[0],corrected=await f.ok(f.a.token,'/api/memories/'+original.id+'/correct','POST',{operationId:randomUUID(),correction:{version:original.version,title:'Owner corrected',statement:'Generated owner correction.'}}),deadline=Date.now()+12000;for(;;){const job=await f.ok(f.a.token,'/api/memory/jobs/'+corrected.id);if(job.tasks.correct?.state==='succeeded')break;assert.ok(Date.now()<deadline,JSON.stringify(job));await delay(10);}const a=await f.connect(await f.mint(f.a.token,'read',[])),old=value(await call(a.client,'mote_memories',{id:'memory:'+original.id,version:1}));assert.equal(old.items[0].version,1);assert.equal(old.items[0].statement,original.statement);assert.equal(value(await call(a.client,'mote_memories',{id:'memory:'+original.id})).items[0].version,2);assert.equal((await call(a.client,'mote_memories',{version:1})).isError,true);
});
