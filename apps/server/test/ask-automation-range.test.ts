import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './fixtures/multiuser-ask-suite.js';

test('Insight policy observation separates scheduling metadata from the owner source, time and device range',async t=>{
 const f=await fixture(t);
 await f.publish(f.a,'A');await f.publish(f.a,'A','other-source','other-original');await f.publish(f.b,'B');
 const samePolicy=randomUUID(),observe=async(user:typeof f.a,id:string,scope:Record<string,unknown>={})=>{
  await f.checked(user.token,'/api/ask-automations','POST',{id,kind:'insights',includeExisting:true,...scope});
  return (await f.checked(user.token,'/api/ask-automations/'+id)).observation;
 };
 for(const user of [f.a,f.b])assert.equal((await observe(user,samePolicy,{sourceIds:['same-source']})).pendingChanges,1,'The policy kind must not become an evidence kind filter; same policy IDs remain owner-scoped');
 assert.equal((await observe(f.a,randomUUID())).pendingChanges,2,'An unscoped owner policy sees both owned source increments');
 assert.equal((await observe(f.a,randomUUID(),{sourceIds:['same-source'],after:'2026-01-01T00:00:00Z',before:'2026-01-02T00:00:00Z',deviceId:'same-device'})).pendingChanges,1);
 assert.equal((await observe(f.a,randomUUID(),{sourceIds:['same-source'],deviceId:'another-device'})).pendingChanges,0,'The explicit device range stays restrictive');
 assert.equal((await observe(f.a,randomUUID(),{sourceIds:['same-source'],before:'2026-01-01T00:00:00Z'})).pendingChanges,0,'The exclusive end of the time range stays restrictive');
 assert.equal(f.requests.length,0,'Observation does not bypass the configured interval or start a model call');
});
