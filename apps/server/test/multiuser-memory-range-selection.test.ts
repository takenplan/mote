import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';

const range={after:'2026-01-01T00:00:00Z',before:'2026-01-02T00:00:00Z',deviceId:'same-device'};
test('manual range uses capture context time and exact canonical evidence pins without broadening a selected original',async t=>{
 const f=await scopedMemoryFixture(t),a=await f.publish(f.a,'A'),b=await f.publish(f.b,'B');assert.equal(a.id,b.id);
 const selected=await f.request(f.a.token,'/api/memory/selection?'+new URLSearchParams(range));assert.equal(selected.statusCode,200,selected.body);const value=selected.json();assert.equal(value.status,'ready');assert.deepEqual(value.materialRevisions,{[a.id]:a.revision});assert.equal(value.evidencePins.length,1);assert.equal(f.requests.length,0,'read-only selection admits no model');
 const captures=(await f.request(f.a.token,'/api/capture-browser/previews?'+new URLSearchParams(range))).json();const id=captures.items[0].id,raw=await f.request(f.a.token,'/api/memory/selection?captureId='+id);assert.equal(raw.statusCode,200,raw.body);assert.deepEqual(raw.json().evidencePins,value.evidencePins);
 const noMatch=await f.request(f.a.token,'/api/memory/selection?'+new URLSearchParams({...range,deviceId:'no-device'}));assert.equal(noMatch.statusCode,200,noMatch.body);assert.equal(noMatch.json().status,'empty');
 const job=await f.request(f.a.token,'/api/memory/jobs','POST',{operationId:randomUUID(),materialIds:Object.keys(value.materialRevisions),materialRevisions:value.materialRevisions,evidencePins:value.evidencePins});assert.equal(job.statusCode,200,job.body);await f.wait(f.a,job.json().id);assert.ok(f.requests.every(call=>!call.raw.includes('GENERATED_MEMORY_B')));assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,0);
 const wrong=await f.request(f.b.token,'/api/memory/jobs','POST',{operationId:randomUUID(),materialIds:Object.keys(value.materialRevisions),materialRevisions:value.materialRevisions,evidencePins:value.evidencePins});assert.notEqual(wrong.statusCode,200,'A evidence pins do not bind to B same Material IDs');
});
