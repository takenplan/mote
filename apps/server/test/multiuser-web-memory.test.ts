import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultModelSettings} from '../src/model-settings.js';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';

test('manual Memory request retains an owned model choice through publication without changing the feature default',async t=>{
 const f=await scopedMemoryFixture(t),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B');assert.equal(am.id,bm.id);
 const profile={id:'same-model',name:'Generated memory model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_A_KEY',headers:{},extraBody:{}}};
 await f.replace(f.a.token,'models',{profiles:[profile,{...profile,id:'only-a',name:'Generated A temporary choice'}],selections:{memory:{kind:'personal',id:'same-model'}}});
 const before=(await f.request(f.a.token,'/api/models/selection/memory')).json(),id=randomUUID(),input={operationId:id,materialIds:[am.id],modelReference:{kind:'personal',id:'only-a'},modelOverride:'generated-memory-alternate'};
 const response=await f.request(f.a.token,'/api/memory/jobs','POST',input);assert.equal(response.statusCode,200,response.body);await f.wait(f.a,id);
 assert.ok(f.requests.length>=2);assert.ok(f.requests.every(r=>r.body.model==='generated-memory-alternate'&&r.key==='GENERATED_A_KEY'&&!r.raw.includes('GENERATED_MEMORY_B')));
 assert.deepEqual((await f.request(f.a.token,'/api/models/selection/memory')).json(),before);
 assert.equal((await f.request(f.a.token,'/api/memory/jobs','POST',input)).statusCode,200);
 assert.equal((await f.request(f.a.token,'/api/memory/jobs','POST',{...input,modelReference:{kind:'personal',id:'same-model'}})).statusCode,409,'same operation cannot silently accept a changed requested model');
 const count=f.requests.length;assert.equal((await f.request(f.b.token,'/api/memory/jobs','POST',{...input,operationId:randomUUID(),materialIds:[bm.id]})).statusCode,400);assert.equal(f.requests.length,count,'B never receives A-only model connection');
});

test('manual Material admission pins the selected canonical revision instead of silently adopting a newer version',async t=>{
 const f=await scopedMemoryFixture(t),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B'),input={operationId:randomUUID(),materialIds:[am.id],materialRevisions:{[am.id]:am.revision}};
 const first=await f.request(f.a.token,'/api/memory/jobs','POST',input);assert.equal(first.statusCode,200,first.body);await f.wait(f.a,input.operationId);
 const context=await f.node.authority.authenticate(f.a.token),draft=f.read(db=>JSON.parse(String(db.prepare('SELECT json FROM pd_material_versions WHERE user_id=? AND material_id=? AND revision=?').get(f.a.userId,am.id,am.revision)!.json)));draft.title='Generated updated canonical version';const fresh=f.node.ingress.bindSource(context,['same-source'],()=>{}).publishMaterial(draft,am.revision);assert.notEqual(fresh.revision,am.revision);
 const count=f.requests.length;assert.equal((await f.request(f.a.token,'/api/memory/jobs','POST',{...input,operationId:randomUUID()})).statusCode,409);assert.equal(f.requests.length,count);
 assert.equal((await f.request(f.b.token,'/api/memory/jobs','POST',{...input,operationId:randomUUID(),materialIds:[bm.id]})).statusCode,404);
 assert.equal((await f.request(f.a.token,'/api/memory/jobs','POST',{...input,operationId:randomUUID(),materialRevisions:{}})).statusCode,400,'partial pin maps cannot silently fall back to current revisions');
});

test('manual Material preview is owner-bound and reuses actual M07 evidence without admitting work',async t=>{
 const f=await scopedMemoryFixture(t),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B'),before=f.read(db=>Number(db.prepare('SELECT count(*) n FROM mm_jobs').get()!.n));
 const preview=await f.request(f.a.token,'/api/memory/materials/'+am.id+'?revision='+am.revision);assert.equal(preview.statusCode,200,preview.body);const a=preview.json();assert.equal(a.status,'ready');assert.equal(a.ref,am.ref);assert.ok(a.evidenceIds.length);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mm_jobs').get()!.n)),before);
 assert.equal((await f.request(f.b.token,'/api/memory/materials/'+am.id+'?revision='+am.revision)).statusCode,404);
 const b=(await f.request(f.b.token,'/api/memory/materials/'+bm.id+'?revision='+bm.revision)).json();assert.equal(b.status,'ready');assert.notDeepEqual(b.evidenceIds,a.evidenceIds);
 const admitted=await f.request(f.a.token,'/api/memory/jobs','POST',{operationId:randomUUID(),materialIds:[a.materialId],materialRevisions:{[a.materialId]:am.revision}});assert.equal(admitted.statusCode,200,admitted.body);await f.wait(f.a,admitted.json().id);const saved=(await f.request(f.a.token,'/api/memories')).json().items[0];assert.deepEqual(saved.evidenceIds,a.evidenceIds);
});
