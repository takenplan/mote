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
