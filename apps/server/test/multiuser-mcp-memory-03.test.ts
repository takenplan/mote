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

test('actual SDK Memory tools/resources read the real automatic MCP to M06 to independently reviewed M07 chain for A/B',async t=>{
 const f=await memoryFixture(t),sessions=[];
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){await f.ok(user.token,'/api/sources/same-source','PATCH',{retention:'archive'});const processing=await f.ok(user.token,'/api/processing');await f.replace(user,'processing',{...processing.settings,automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false});const memory=defaultMemorySettings();memory.lifecycle.extraction.minChanges=1;await f.replace(user,'memory',{...memory,automatic:true,integration:false});const writer=await f.connect(await f.mint(user.token,'write'));assert.equal((await call(writer.client,'mote_put_item',{sourceId:'same-source',item:item(memoryText(owner))})).isError,undefined);sessions.push(await f.connect(await f.mint(user.token)));}
 const deadline=Date.now()+20000,memories=[];for(const [index,user,owner,other]of [[0,f.a,'A','B'],[1,f.b,'B','A']] as const){let page:any;for(;;){page=value(await call(sessions[index].client,'mote_memories'));if(page.items?.length)break;assert.ok(Date.now()<deadline,JSON.stringify(page));await delay(10);}assert.equal(page.items.length,1);assert.match(JSON.stringify(page),new RegExp(memoryText(owner)));assert.doesNotMatch(JSON.stringify(page),new RegExp(memoryText(other)));memories.push(page.items[0]);const resource=await sessions[index].client.readResource({uri:'mote://memories'});assert.match(JSON.stringify(resource),new RegExp(memoryText(owner)));assert.doesNotMatch(JSON.stringify(resource),new RegExp(memoryText(other)));assert.equal((await f.ok(user.token,'/api/materials')).items.length,1);}
 assert.ok(f.requests.length>=4,'actual extraction and independent review each use the model transport');for(const request of f.requests)assert.ok(!request.raw.includes(memoryText(request.owner==='A'?'B':'A')));assert.equal((await call(sessions[0].client,'mote_memories',{id:'memory:'+memories[1].id})).isError,true);assert.equal((await f.request((await f.mint(f.a.token)).token,'/api/memories')).statusCode,401);
});

test('MCP Memory uses actual external provider bodies and fixed failures without a cached SQL fallback',async t=>{
 const f=await memoryFixture(t,true);for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){const material=await f.publish(user,owner);await f.extract(user,material.id);}const directories=await f.externalize(),a=await f.connect(await f.mint(f.a.token)),b=await f.connect(await f.mint(f.b.token)),directory=directories.get(f.a.userId)!;
 assert.equal(value(await call(a.client,'mote_memories',{query:'tea'})).items.length,1);assert.match(JSON.stringify(await call(b.client,'mote_memories')),/Generated B/);writeFileSync(join(directory,'fail-read'),'generated');const failed=await call(a.client,'mote_memories');assert.equal(failed.isError,true);assert.equal(value(failed).error,'memory_provider_unavailable');assert.doesNotMatch(JSON.stringify(failed),/Nora|GENERATED_A_KEY|Generated external/);await assert.rejects(a.client.readResource({uri:'mote://memories'}));assert.match(JSON.stringify(await call(b.client,'mote_memories')),/Generated B/);unlinkSync(join(directory,'fail-read'));writeFileSync(join(directory,'fail-search'),'generated');assert.equal((await call(a.client,'mote_memories',{query:'tea'})).isError,true);unlinkSync(join(directory,'fail-search'));assert.equal(value(await call(a.client,'mote_memories',{query:'tea'})).items.length,1);
});

test('MCP final Memory page fence rejects an earlier deleted entry while a later actual provider read is held',async t=>{
 const f=await memoryFixture(t,true);for(const id of ['first','second']){const material=await f.publish(f.a,'A','same-source',id);await f.extract(f.a,material.id);}const directories=await f.externalize([f.a]),rows=(await f.ok(f.a.token,'/api/memories')).items,[first,second]=rows,gate=f.hold(directories.get(f.a.userId)!,second.id),a=await f.connect(await f.mint(f.a.token)),pending=call(a.client,'mote_memories',{limit:2});await gate.entered();await f.ok(f.a.token,'/api/memories/'+first.id,'DELETE');gate.release();const result=await pending;assert.equal(result.isError,true);assert.doesNotMatch(JSON.stringify(result),/Nora prefers|GENERATED_MCP_MEMORY_A/);
});
