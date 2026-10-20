import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {generatedHindsightRelease} from './fixtures/scoped-memory-release.js';
import {hindsightHttpFixture} from './fixtures/hindsight-http.js';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};};

test('each native relay model call shares Memory admission across accounts without metering capacity waiting',{timeout:45000},async t=>{
 const release=deferred(),entered=deferred(),beforeCall=deferred(),continueCall=deferred();let heldOwner:string|undefined;t.after(()=>{release.resolve();continueCall.resolve();});
 const native=await hindsightHttpFixture({beforeRequest:async event=>{if(event.userId===heldOwner&&event.method==='PUT'&&!event.path&&event.bank.startsWith('mote-stage-')){beforeCall.resolve();await continueCall.promise;}}});t.after(()=>native.close());const f=await scopedMemoryFixture(t,generatedHindsightRelease(),native.runtimeFactory,()=> '2037-04-10T08:00:00.000Z'),pkg=await f.install(),materials=[];
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']]as const){materials.push(await f.publish(user,owner));await f.plugin(user,pkg,['same-source'],{modelProfileId:'personal:same-model'},['engine']);await f.bind(user,'same-instance');}
 const {queues:_,scope:__,revision,...settings}=(await f.request(f.admin.token,'/api/admin/execution-settings')).json(),configured=await f.request(f.admin.token,'/api/admin/execution-settings','PUT',{...settings,revision,llmConcurrency:2,agentConcurrency:2,memoryConcurrency:2});assert.equal(configured.statusCode,200,configured.body);
 const beforeB=(await f.request(f.b.token,'/api/usage')).json().items.length;let active=0,peak=0;const nativeCalls:string[]=[];native.faults.beforeSemantic=async userId=>{nativeCalls.push(userId);active++;peak=Math.max(peak,active);entered.resolve();await release.promise;active--;};
 const a=await f.submit(f.a,[materials[0].id]);await entered.promise;heldOwner=f.b.userId;const b=await f.submit(f.b,[materials[1].id]);await beforeCall.promise;
 const running=await f.request(f.b.token,'/api/tasks/'+b.tasks.batch.id);assert.equal(running.statusCode,200,running.body);assert.equal(running.json().state,'running');assert.equal(running.json().attempts,0,'a native continuation before its first model call has no charged attempt');
 // The qualified executor also follows Memory's live limit. Admit both real
 // continuations first, then reduce capacity while B is held before its relay.
 // This reaches per-call admission instead of merely queuing B's durable task.
 const current=(await f.request(f.admin.token,'/api/admin/execution-settings')).json(),reduced=await f.request(f.admin.token,'/api/admin/execution-settings','PUT',{...settings,revision:current.revision,llmConcurrency:1,agentConcurrency:1,memoryConcurrency:1});assert.equal(reduced.statusCode,200,reduced.body);continueCall.resolve();
 const end=Date.now()+10000;let queued=false;while(Date.now()<end){const view=(await f.request(f.admin.token,'/api/admin/execution-settings')).json();if(view.queues.memory.waiting===1){queued=true;break;}if(peak>1)break;await delay(10);}
 assert.equal(peak,1,'native requests use the same physical model limit as Agent queries');assert.equal(queued,true,'the other running continuation waits in real Memory model admission');const waiting=await f.request(f.b.token,'/api/tasks/'+b.tasks.batch.id);assert.equal(waiting.json().state,'running');assert.equal(waiting.json().attempts,0);assert.equal((await f.request(f.b.token,'/api/usage')).json().items.length,beforeB,'unissued native waiting has no execution-time fragment');release.resolve();await Promise.all([f.wait(f.a,a.id),f.wait(f.b,b.id)]);assert.equal(peak,1);assert.deepEqual(nativeCalls,[f.a.userId,f.b.userId],'the queued owner takes the next actual native turn');assert.equal(f.requests.length,2,'native drafts bypass Mote extraction but both receive an independent Mote review');for(const request of f.requests){const value=JSON.parse(typeof request.body.messages[0].content==='string'?request.body.messages[0].content:request.body.messages[0].content[0].text);assert.ok(value.untrustedTaskContext.untrustedMemoryDraft);assert.equal(value.requiredSkill,'memory-strategy');assert.equal(value.currentTime,'2037-04-10T08:00:00.000Z');}
});
