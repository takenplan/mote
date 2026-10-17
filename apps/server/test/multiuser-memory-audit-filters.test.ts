import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';

test('retained owner audit applies the original filters before signed pagination without granting current Memory or model authority',async t=>{
 const f=await scopedMemoryFixture(t),materials=[];
 for(const [user,label,external] of [[f.a,'A','first'],[f.a,'A','second'],[f.b,'B','first']] as const){const material=await f.publish(user,label,'same-source',external);await f.wait(user,(await f.submit(user,[material.id])).id);materials.push({user,material});}
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,2,'the fixture first publishes two actual A memories');
 for(const {user,material} of materials){const context=await f.node.authority.authenticate(user.token),draft=f.read(db=>JSON.parse(String(db.prepare('SELECT json FROM pd_material_versions WHERE user_id=? AND material_id=? AND revision=?').get(user.userId,material.id,material.revision)!.json)));draft.title='Generated changed audit source';f.node.ingress.bindSource(context,['same-source'],()=>{}).publishMaterial(draft,material.revision);}
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0,'stale bodies are no longer current Memory');
 const before=f.requests.length,query=new URLSearchParams({kind:'stale',limit:'1',query:'Generated A',layer:'memory',tier:'episode',deviceId:'same-device',after:'2025-12-01T00:00:00Z',before:'2026-02-01T00:00:00Z'}),first=await f.request(f.a.token,'/api/memory/audit?'+query);
 assert.equal(first.statusCode,200,first.body);const a=first.json();assert.equal(a.items.length,1);assert.equal(a.items[0].usableAsMemory,false);assert.ok(a.nextCursor);
 const next=await f.request(f.a.token,'/api/memory/audit?'+new URLSearchParams([...query,['cursor',a.nextCursor]]));assert.equal(next.statusCode,200,next.body);assert.equal(next.json().items.length,1);assert.notEqual(next.json().items[0].id,a.items[0].id);assert.equal(next.json().nextCursor,null);
 for(const [key,value] of [['query','NO_MATCH_GENERATED'],['layer','observation'],['tier','consolidated'],['deviceId','other-device'],['after','2026-01-02T00:00:00Z']] as const){const filtered=new URLSearchParams(query);filtered.set(key,value);const read=await f.request(f.a.token,'/api/memory/audit?'+filtered);assert.equal(read.statusCode,200,read.body);assert.deepEqual(read.json().items,[]);assert.equal(read.json().nextCursor,null);}
 const altered=new URLSearchParams(query);altered.set('cursor',a.nextCursor);altered.set('query','Generated B');assert.equal((await f.request(f.a.token,'/api/memory/audit?'+altered)).statusCode,400);assert.equal((await f.request(f.b.token,'/api/memory/audit?'+new URLSearchParams([...query,['cursor',a.nextCursor]]))).statusCode,400);
 const bq=new URLSearchParams(query);bq.set('query','Generated B');const b=await f.request(f.b.token,'/api/memory/audit?'+bq);assert.equal(b.statusCode,200,b.body);assert.equal(b.json().items.length,1);
 const detail=await f.request(f.a.token,'/api/memory/audit/'+a.items[0].id+'?version='+a.items[0].version);assert.equal(detail.statusCode,200,detail.body);assert.equal(detail.json().usableAsMemory,false);assert.match(detail.body,/GENERATED_MEMORY_A/);assert.doesNotMatch(detail.body,/GENERATED_MEMORY_B/);assert.equal((await f.request(f.b.token,'/api/memory/audit/'+a.items[0].id)).statusCode,404);
 assert.equal((await f.request(f.a.token,'/api/memories/'+a.items[0].id)).statusCode,404);assert.equal((await f.request(f.a.token,'/api/memories?status=stale')).statusCode,400);assert.equal(f.requests.length,before,'audit reads and filters do not admit or query a model');
});
